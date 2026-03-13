/**
 * Conversation Processing Pipeline (PX-865)
 * Main orchestration for processing recorded conversations
 */

import { prisma } from "@/lib/db";
import { ConversationStatus, ProcessingStatus, WorkflowOutputType } from "@prisma/client";
import {
  transcribeFromUrl,
  transcribeFromBuffer,
  formatTranscriptAsText,
  type TranscriptSegment,
} from "@/lib/deepgram/transcribe";
import { detectSensitivity, type FlaggedSegmentResult } from "@/lib/nlp";
import { generateWorkflowOutputs, type GeneratedOutputs } from "./workflow-outputs";
import { transferRecordingToS3, isS3Configured, downloadRecording } from "@/lib/storage/s3";
import { isDeepgramConfigured } from "@/lib/deepgram/client";
import { createAuditLog } from "@/lib/audit/service";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export interface ProcessingResult {
  success: boolean;
  conversationId: string;
  transcript?: {
    raw: string;
    segments: TranscriptSegment[];
  };
  sensitivityResults?: {
    flaggedCount: number;
    overallTier: string;
  };
  outputs?: GeneratedOutputs;
  error?: string;
}

interface ConversationWithOrg {
  id: string;
  orgId: string;
  type: string;
  title: string | null;
  recordingUrl: string | null;
  aiProcessingRetries: number;
  formIds: string[];
  createdById: string;
  organization: {
    id: string;
    recordingRetentionDays: number;
  };
}

/**
 * Main entry point: Process a completed conversation
 */
export async function processConversation(
  conversationId: string
): Promise<ProcessingResult> {
  console.log(`[ConversationProcessing] Starting processing for ${conversationId}`);

  try {
    // Step 1: Update status to processing
    await updateStatus(conversationId, "PROCESSING");

    // Step 2: Fetch conversation with org info
    const conversation = await getConversationForProcessing(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.recordingUrl) {
      throw new Error("No recording URL available");
    }

    // Step 3: Transfer recording to S3 if configured
    let recordingSource = conversation.recordingUrl;
    if (isS3Configured() && !recordingSource.startsWith("recordings/")) {
      console.log(`[ConversationProcessing] Transferring recording to S3`);
      const s3Key = await transferRecordingToS3(
        conversation.recordingUrl,
        conversation.orgId,
        conversationId
      );
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { recordingUrl: s3Key },
      });
      recordingSource = s3Key;
    }

    // Step 4: Transcribe the recording
    console.log(`[ConversationProcessing] Transcribing recording`);
    const transcription = await transcribeRecording(recordingSource);

    // Save transcript
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        transcriptRaw: transcription.raw,
        transcriptJson: transcription.segments as unknown as object,
      },
    });

    // Step 5: Sensitivity detection
    console.log(`[ConversationProcessing] Running sensitivity detection`);
    const sensitivityResults = await detectSensitivity(transcription.segments);

    // Store flagged segments
    if (sensitivityResults.segments.length > 0) {
      await storeFlaggedSegments(conversationId, sensitivityResults.segments);
    }

    // Update sensitivity tier
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        sensitivityTier: sensitivityResults.overallSensitivity,
      },
    });

    // Step 6: Generate workflow outputs
    console.log(`[ConversationProcessing] Generating workflow outputs`);
    const outputResult = await generateWorkflowOutputs(
      transcription.raw,
      transcription.segments,
      conversation.title || undefined,
      [] // TODO: Get attendee names from conversation participants
    );

    // Store drafted outputs
    if (outputResult.success) {
      await storeDraftedOutputs(conversationId, outputResult.outputs);
    }

    // Step 7: Match to goals (if applicable)
    // TODO: Implement goal matching

    // Step 8: Determine final status
    const hasFlaggedContent = sensitivityResults.segments.length > 0;
    const hasOutputs =
      outputResult.outputs.actionItems.length > 0 ||
      outputResult.outputs.calendarEvents.length > 0 ||
      outputResult.outputs.goalUpdates.length > 0;

    const finalStatus: ConversationStatus =
      hasFlaggedContent || hasOutputs ? "REVIEW" : "COMPLETED";

    await updateStatus(conversationId, finalStatus);

    // Audit log
    await createAuditLog({
      orgId: conversation.orgId,
      userId: conversation.createdById,
      action: "UPDATE",
      resource: "CONVERSATION",
      resourceId: conversationId,
      details: {
        action: "processed",
        flaggedSegments: sensitivityResults.segments.length,
        actionItemsGenerated: outputResult.outputs.actionItems.length,
        status: finalStatus,
      },
    });

    return {
      success: true,
      conversationId,
      transcript: transcription,
      sensitivityResults: {
        flaggedCount: sensitivityResults.segments.length,
        overallTier: sensitivityResults.overallSensitivity,
      },
      outputs: outputResult.outputs,
    };
  } catch (error) {
    console.error(`[ConversationProcessing] Error:`, error);

    // Handle retry logic
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { aiProcessingRetries: true },
    });

    const retries = (conversation?.aiProcessingRetries || 0) + 1;

    if (retries < MAX_RETRIES) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          aiProcessingStatus: ProcessingStatus.QUEUED_FOR_RETRY,
          aiProcessingRetries: retries,
          aiProcessingError: error instanceof Error ? error.message : "Unknown error",
        },
      });

      // Schedule retry
      setTimeout(() => {
        processConversation(conversationId).catch(console.error);
      }, RETRY_DELAY_MS * retries);
    } else {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: "FAILED",
          aiProcessingStatus: ProcessingStatus.FAILED,
          aiProcessingError: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    return {
      success: false,
      conversationId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update conversation status
 */
async function updateStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status,
      aiProcessingStatus:
        status === "PROCESSING"
          ? ProcessingStatus.PROCESSING
          : status === "COMPLETED" || status === "REVIEW"
          ? ProcessingStatus.COMPLETED
          : status === "FAILED"
          ? ProcessingStatus.FAILED
          : undefined,
    },
  });
}

/**
 * Get conversation for processing
 */
async function getConversationForProcessing(
  conversationId: string
): Promise<ConversationWithOrg | null> {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      orgId: true,
      type: true,
      title: true,
      recordingUrl: true,
      aiProcessingRetries: true,
      formIds: true,
      createdById: true,
      organization: {
        select: {
          id: true,
          recordingRetentionDays: true,
        },
      },
    },
  });
}

/**
 * Transcribe recording from URL or S3 key
 */
async function transcribeRecording(
  source: string
): Promise<{ raw: string; segments: TranscriptSegment[] }> {
  if (!isDeepgramConfigured()) {
    throw new Error("Deepgram not configured");
  }

  let result;

  // Check if source is an S3 key (not a URL)
  if (source.startsWith("recordings/") || source.startsWith("in-person/")) {
    // Download from S3 and transcribe from buffer
    console.log(`[ConversationProcessing] Downloading recording from S3: ${source}`);
    const buffer = await downloadRecording(source);

    // Determine mime type from extension
    const mimeType = source.endsWith(".webm") ? "audio/webm" : "audio/mp3";
    result = await transcribeFromBuffer(buffer, mimeType);
  } else {
    // Direct URL transcription
    result = await transcribeFromUrl(source);
  }

  const raw = formatTranscriptAsText(result.segments);
  return { raw, segments: result.segments };
}

/**
 * Store flagged segments in database
 */
async function storeFlaggedSegments(
  conversationId: string,
  segments: FlaggedSegmentResult[]
): Promise<void> {
  await prisma.flaggedSegment.createMany({
    data: segments.map((segment) => ({
      conversationId,
      startTime: segment.startTime,
      endTime: segment.endTime,
      text: segment.text,
      category: segment.category,
      confidence: segment.confidence,
      suggestedTier: segment.suggestedTier,
    })),
  });
}

/**
 * Store drafted outputs in database
 */
async function storeDraftedOutputs(
  conversationId: string,
  outputs: GeneratedOutputs
): Promise<void> {
  const drafts: Array<{
    conversationId: string;
    outputType: WorkflowOutputType;
    title: string | null;
    content: string;
    metadata: object;
    sourceSnippet: string | null;
  }> = [];

  // Action items
  for (const item of outputs.actionItems) {
    drafts.push({
      conversationId,
      outputType: "ACTION_ITEM",
      title: item.title,
      content: item.description,
      metadata: {
        assignee: item.assignee,
        dueDate: item.dueDate,
        priority: item.priority,
        labels: item.labels,
      },
      sourceSnippet: item.sourceSnippet,
    });
  }

  // Meeting notes
  if (outputs.meetingNotes) {
    drafts.push({
      conversationId,
      outputType: "MEETING_NOTES",
      title: outputs.meetingNotes.title,
      content: outputs.meetingNotes.content,
      metadata: {
        sections: outputs.meetingNotes.sections,
        attendees: outputs.meetingNotes.attendees,
        actionItems: outputs.meetingNotes.actionItems,
        keyDecisions: outputs.meetingNotes.keyDecisions,
      },
      sourceSnippet: outputs.meetingNotes.sourceSnippet || null,
    });
  }

  // Calendar events
  for (const event of outputs.calendarEvents) {
    drafts.push({
      conversationId,
      outputType: "CALENDAR_EVENT",
      title: event.title,
      content: event.description,
      metadata: {
        startTime: event.startTime,
        duration: event.duration,
        attendees: event.attendees,
        location: event.location,
      },
      sourceSnippet: event.sourceSnippet,
    });
  }

  // Goal updates
  for (const update of outputs.goalUpdates) {
    drafts.push({
      conversationId,
      outputType: "GOAL_UPDATE",
      title: update.goalTitle || null,
      content: update.description,
      metadata: {
        goalId: update.goalId,
        updateType: update.updateType,
        percentComplete: update.percentComplete,
      },
      sourceSnippet: update.sourceSnippet,
    });
  }

  // Delay signals
  for (const signal of outputs.delaySignals) {
    drafts.push({
      conversationId,
      outputType: "DELAY_SIGNAL",
      title: signal.taskTitle,
      content: signal.reason,
      metadata: {
        delayType: signal.delayType,
        delayDays: signal.delayDays,
        confidence: signal.confidence,
      },
      sourceSnippet: signal.sourceSnippet,
    });
  }

  if (drafts.length > 0) {
    await prisma.draftedOutput.createMany({
      data: drafts.map((draft) => ({
        ...draft,
        metadata: draft.metadata as object,
      })),
    });
  }
}

/**
 * Reprocess a conversation (e.g., after manual correction)
 */
export async function reprocessConversation(
  conversationId: string
): Promise<ProcessingResult> {
  // Delete existing drafts and flagged segments
  await Promise.all([
    prisma.draftedOutput.deleteMany({ where: { conversationId } }),
    prisma.flaggedSegment.deleteMany({ where: { conversationId } }),
  ]);

  // Reset status
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "PROCESSING",
      aiProcessingStatus: ProcessingStatus.PENDING,
      aiProcessingRetries: 0,
      aiProcessingError: null,
    },
  });

  return processConversation(conversationId);
}

/**
 * Process conversation without transcription (for already transcribed)
 */
export async function processTranscribedConversation(
  conversationId: string
): Promise<ProcessingResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      orgId: true,
      title: true,
      transcriptRaw: true,
      transcriptJson: true,
      createdById: true,
    },
  });

  if (!conversation) {
    return { success: false, conversationId, error: "Conversation not found" };
  }

  if (!conversation.transcriptRaw || !conversation.transcriptJson) {
    return { success: false, conversationId, error: "No transcript available" };
  }

  const segments = conversation.transcriptJson as unknown as TranscriptSegment[];

  // Run sensitivity detection
  const sensitivityResults = await detectSensitivity(segments);
  if (sensitivityResults.segments.length > 0) {
    await storeFlaggedSegments(conversationId, sensitivityResults.segments);
  }

  // Generate outputs
  const outputResult = await generateWorkflowOutputs(
    conversation.transcriptRaw,
    segments,
    conversation.title || undefined
  );

  if (outputResult.success) {
    await storeDraftedOutputs(conversationId, outputResult.outputs);
  }

  // Update status
  const hasFlaggedContent = sensitivityResults.segments.length > 0;
  const hasOutputs =
    outputResult.outputs.actionItems.length > 0 ||
    outputResult.outputs.calendarEvents.length > 0;

  const finalStatus: ConversationStatus =
    hasFlaggedContent || hasOutputs ? "REVIEW" : "COMPLETED";

  await updateStatus(conversationId, finalStatus);

  return {
    success: true,
    conversationId,
    transcript: {
      raw: conversation.transcriptRaw,
      segments,
    },
    sensitivityResults: {
      flaggedCount: sensitivityResults.segments.length,
      overallTier: sensitivityResults.overallSensitivity,
    },
    outputs: outputResult.outputs,
  };
}

/**
 * Queue conversation for background processing
 */
export async function queueForProcessing(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      aiProcessingStatus: ProcessingStatus.QUEUED_FOR_RETRY,
    },
  });

  // In production, this would push to a job queue (Bull, SQS, etc.)
  // For now, process immediately in background
  setImmediate(() => {
    processConversation(conversationId).catch(console.error);
  });
}
