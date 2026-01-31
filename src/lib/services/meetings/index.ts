/**
 * Meeting Intelligence Service - Main Entry Point
 *
 * Coordinates meeting creation, transcription, summarization,
 * and email distribution.
 */

import { prisma } from "@/lib/db";
import { MeetingStatus, Prisma } from "@prisma/client";
import { createJobProgress, updateJobProgress, markJobCompleted, markJobFailed } from "@/lib/jobs/progress";
import { getJobQueue } from "@/lib/jobs/queue";
import { transcribeAudio, matchSpeakersToParticipants } from "./transcription";
import { summarizeMeeting, summarizeLongMeeting } from "./summarization";
import { sendSummaryEmail } from "./email-distribution";
import {
  CreateMeetingParams,
  UpdateMeetingParams,
  MeetingParticipant,
  MeetingProcessingJobData,
  MeetingSearchParams,
  TranscriptSegment,
} from "./types";

// Re-export modules
export * from "./types";
export * from "./transcription";
export * from "./summarization";
export * from "./email-distribution";

// ============================================
// MEETING CRUD
// ============================================

/**
 * Create a new meeting
 */
export async function createMeeting(params: CreateMeetingParams) {
  const {
    orgId,
    createdById,
    title,
    description,
    source = "UPLOAD",
    scheduledStartAt,
    scheduledEndAt,
    participants,
    locationId,
    tags,
    externalMeetingId,
    externalJoinUrl,
  } = params;

  const meeting = await prisma.meeting.create({
    data: {
      orgId,
      title,
      description,
      source,
      status: scheduledStartAt ? "SCHEDULED" : "PROCESSING",
      scheduledStartAt,
      scheduledEndAt,
      participants: participants as unknown as Prisma.InputJsonValue,
      participantCount: participants?.length,
      locationId,
      tags: tags || [],
      externalMeetingId,
      externalJoinUrl,
      createdById,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      location: true,
    },
  });

  return meeting;
}

/**
 * Update meeting details
 */
export async function updateMeeting(
  meetingId: string,
  orgId: string,
  params: UpdateMeetingParams
) {
  const meeting = await prisma.meeting.update({
    where: { id: meetingId, orgId },
    data: {
      title: params.title,
      description: params.description,
      scheduledStartAt: params.scheduledStartAt,
      scheduledEndAt: params.scheduledEndAt,
      participants: params.participants as unknown as Prisma.InputJsonValue,
      participantCount: params.participants?.length,
      locationId: params.locationId,
      tags: params.tags,
    },
  });

  return meeting;
}

/**
 * Get meeting by ID
 */
export async function getMeeting(meetingId: string, orgId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      location: true,
      transcript: true,
      summary: true,
      actionItems: {
        orderBy: { createdAt: "asc" },
        include: {
          assigneeUser: { select: { id: true, name: true, email: true } },
        },
      },
      questions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * Search/list meetings
 */
export async function searchMeetings(params: MeetingSearchParams) {
  const {
    orgId,
    query,
    status,
    source,
    locationId,
    fromDate,
    toDate,
    participantEmail,
    tags,
    limit = 20,
    offset = 0,
  } = params;

  const where: Prisma.MeetingWhereInput = {
    orgId,
    ...(status && { status }),
    ...(source && { source }),
    ...(locationId && { locationId }),
    ...(fromDate && { scheduledStartAt: { gte: fromDate } }),
    ...(toDate && { scheduledStartAt: { lte: toDate } }),
    ...(tags?.length && { tags: { hasSome: tags } }),
  };

  // Add text search on title/description
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  // Participant email search is more complex - search in JSON
  if (participantEmail) {
    where.participants = {
      path: ["$[*].email"],
      array_contains: participantEmail,
    };
  }

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      orderBy: { scheduledStartAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        createdBy: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, type: true } },
        _count: {
          select: { actionItems: true, questions: true },
        },
      },
    }),
    prisma.meeting.count({ where }),
  ]);

  return { meetings, total };
}

// ============================================
// MEETING PROCESSING
// ============================================

/**
 * Start processing a meeting (queue for async processing)
 */
export async function startMeetingProcessing(params: {
  meetingId: string;
  orgId: string;
  userId: string;
  recordingPath: string;
  options?: {
    skipTranscription?: boolean;
    skipSummarization?: boolean;
    skipEmailDistribution?: boolean;
  };
}): Promise<{ jobProgressId: string; meetingId: string }> {
  const { meetingId, orgId, userId, recordingPath, options } = params;

  // Update meeting status
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "PROCESSING",
      recordingPath,
      processingStartedAt: new Date(),
    },
  });

  // Create job progress
  const jobProgress = await createJobProgress({
    type: "meeting-processing",
    userId,
    orgId,
    total: 100,
    metadata: { meetingId },
  });

  // Queue the job
  const jobData: MeetingProcessingJobData = {
    jobProgressId: jobProgress.id,
    meetingId,
    orgId,
    userId,
    recordingPath,
    options,
  };

  await getJobQueue().add("meeting-processing", jobData);

  return {
    jobProgressId: jobProgress.id,
    meetingId,
  };
}

/**
 * Execute meeting processing (called by job processor)
 */
export async function executeMeetingProcessing(params: {
  meetingId: string;
  orgId: string;
  userId: string;
  recordingPath: string;
  jobProgressId: string;
  options?: {
    skipTranscription?: boolean;
    skipSummarization?: boolean;
    skipEmailDistribution?: boolean;
  };
}): Promise<void> {
  const { meetingId, orgId, userId, jobProgressId, recordingPath, options = {} } = params;

  try {
    // Get meeting details
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const participants = (meeting.participants as unknown as MeetingParticipant[]) || [];

    await updateJobProgress(jobProgressId, { progress: 5 });

    // === TRANSCRIPTION ===
    if (!options.skipTranscription) {
      console.log(`[Meeting ${meetingId}] Starting transcription...`);

      // In production, we'd fetch from S3
      // For MVP, assume recordingPath is a local path or we have the buffer
      // This would need to be adapted based on actual storage implementation
      const audioBuffer = await fetchRecording(recordingPath);

      await updateJobProgress(jobProgressId, { progress: 10 });

      const transcriptResult = await transcribeAudio(audioBuffer, {
        speakerDiarization: true,
        maxSpeakers: participants.length || 10,
      });

      await updateJobProgress(jobProgressId, { progress: 40 });

      // Match speakers to participants if we have names
      const matchedSegments = participants.length > 0
        ? matchSpeakersToParticipants(transcriptResult.segments, participants)
        : transcriptResult.segments;

      // Save transcript
      await prisma.meetingTranscript.create({
        data: {
          meetingId,
          fullText: transcriptResult.fullText,
          wordCount: transcriptResult.wordCount,
          segments: matchedSegments as unknown as Prisma.InputJsonValue,
          language: transcriptResult.language,
          transcriptionModel: transcriptResult.transcriptionModel,
          processingTimeMs: transcriptResult.processingTimeMs,
        },
      });

      // Update meeting with actual times
      const firstSegment = matchedSegments[0];
      const lastSegment = matchedSegments[matchedSegments.length - 1];
      const durationSeconds = lastSegment ? Math.ceil(lastSegment.endTime) : undefined;

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          actualStartAt: meeting.actualStartAt || new Date(),
          durationSeconds,
        },
      });

      console.log(`[Meeting ${meetingId}] Transcription complete: ${transcriptResult.wordCount} words`);
    }

    await updateJobProgress(jobProgressId, { progress: 50 });

    // === SUMMARIZATION ===
    if (!options.skipSummarization) {
      console.log(`[Meeting ${meetingId}] Starting summarization...`);

      // Get transcript
      const transcript = await prisma.meetingTranscript.findUnique({
        where: { meetingId },
      });

      if (!transcript) {
        throw new Error("Transcript not found for summarization");
      }

      const segments = transcript.segments as unknown as TranscriptSegment[];
      const participantNames = participants.map((p) => p.name);

      // Use long meeting summarization if > 2 hours
      const durationSeconds = meeting.durationSeconds || 0;
      const summaryResult = durationSeconds > 7200
        ? await summarizeLongMeeting(segments, meeting.title, participantNames)
        : await summarizeMeeting(segments, meeting.title, participantNames);

      await updateJobProgress(jobProgressId, { progress: 75 });

      // Save summary
      await prisma.meetingSummary.create({
        data: {
          meetingId,
          executiveSummary: summaryResult.executiveSummary,
          keyPoints: summaryResult.keyPoints as unknown as Prisma.InputJsonValue,
          decisions: summaryResult.decisions as unknown as Prisma.InputJsonValue,
          topicsDiscussed: summaryResult.topicsDiscussed,
          summaryModel: summaryResult.summaryModel,
          tokensUsed: summaryResult.tokensUsed,
          processingTimeMs: summaryResult.processingTimeMs,
        },
      });

      // Save action items
      if (summaryResult.actionItems.length > 0) {
        await prisma.meetingActionItem.createMany({
          data: summaryResult.actionItems.map((item) => ({
            meetingId,
            description: item.description,
            assigneeName: item.assigneeName,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            contextSnippet: item.contextSnippet,
          })),
        });
      }

      // Save questions
      if (summaryResult.questions.length > 0) {
        await prisma.meetingQuestion.createMany({
          data: summaryResult.questions.map((q) => ({
            meetingId,
            question: q.question,
            askedByName: q.askedByName,
            isAnswered: q.isAnswered,
            answer: q.answer,
            answeredByName: q.answeredByName,
            contextSnippet: q.contextSnippet,
          })),
        });
      }

      console.log(`[Meeting ${meetingId}] Summarization complete`);
    }

    await updateJobProgress(jobProgressId, { progress: 85 });

    // === EMAIL DISTRIBUTION ===
    if (!options.skipEmailDistribution && participants.length > 0) {
      console.log(`[Meeting ${meetingId}] Sending summary emails...`);

      const recipients = participants
        .filter((p) => p.email)
        .map((p) => ({ email: p.email!, name: p.name }));

      if (recipients.length > 0) {
        await sendSummaryEmail(meetingId, recipients);
      }

      console.log(`[Meeting ${meetingId}] Emails sent to ${recipients.length} recipients`);
    }

    await updateJobProgress(jobProgressId, { progress: 95 });

    // Mark meeting as completed
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "COMPLETED",
        processingCompletedAt: new Date(),
      },
    });

    await markJobCompleted(jobProgressId, { meetingId });

    console.log(`[Meeting ${meetingId}] Processing complete`);
  } catch (error) {
    console.error(`[Meeting ${meetingId}] Processing failed:`, error);

    // Mark as failed
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    await markJobFailed(
      jobProgressId,
      error instanceof Error ? error.message : "Meeting processing failed"
    );

    throw error;
  }
}

/**
 * Fetch recording from storage
 * In production, this would fetch from S3
 */
async function fetchRecording(recordingPath: string): Promise<Buffer> {
  // Check if it's an S3 path
  if (recordingPath.startsWith("s3://") || recordingPath.includes(".s3.")) {
    // TODO: Implement S3 fetch
    throw new Error("S3 fetch not yet implemented. Use direct file upload for MVP.");
  }

  // For MVP/testing, read from local file system
  const fs = await import("fs/promises");
  return fs.readFile(recordingPath);
}

// ============================================
// ACTION ITEMS
// ============================================

/**
 * Update action item status
 */
export async function updateActionItemStatus(
  actionItemId: string,
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  completedById?: string
) {
  return prisma.meetingActionItem.update({
    where: { id: actionItemId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
      completedById: status === "COMPLETED" ? completedById : null,
    },
  });
}

/**
 * Get action items for a user
 */
export async function getUserActionItems(
  userId: string,
  orgId: string,
  status?: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
) {
  // Get user email for matching
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) return [];

  const where: Prisma.MeetingActionItemWhereInput = {
    meeting: { orgId },
    OR: [
      { assigneeUserId: userId },
      { assigneeName: { contains: user.name || "", mode: "insensitive" } },
    ],
    ...(status && { status }),
  };

  return prisma.meetingActionItem.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      meeting: { select: { id: true, title: true } },
    },
  });
}

// ============================================
// RESEND SUMMARY
// ============================================

/**
 * Resend meeting summary email
 */
export async function resendSummaryEmail(
  meetingId: string,
  orgId: string,
  recipientEmails: string[]
) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    include: { summary: true },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (!meeting.summary) {
    throw new Error("Meeting has no summary");
  }

  const recipients = recipientEmails.map((email) => ({ email }));
  return sendSummaryEmail(meetingId, recipients);
}
