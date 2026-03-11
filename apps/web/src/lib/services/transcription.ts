import { prisma } from "@/lib/db";
import {
  transcribeFromUrl,
  transcribeFromBuffer,
  formatTranscriptAsText,
  extractClientStatements,
  type TranscriptSegment,
  type TranscriptionResult,
} from "@/lib/deepgram/transcribe";
import { isDeepgramConfigured } from "@/lib/deepgram/client";
import { downloadRecording, isS3Configured } from "@/lib/storage/s3";

export interface TranscriptionServiceResult {
  success: boolean;
  callId: string;
  transcript?: {
    raw: string;
    formatted: string;
    segments: TranscriptSegment[];
    clientStatements: string;
    duration: number;
    wordCount: number;
  };
  error?: string;
}

/**
 * Transcribe a call recording
 */
export async function transcribeCall(
  callId: string
): Promise<TranscriptionServiceResult> {
  try {
    // Get call with recording URL
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        recordingUrl: true,
        transcriptRaw: true,
      },
    });

    if (!call) {
      return { success: false, callId, error: "Call not found" };
    }

    // Check if already transcribed
    if (call.transcriptRaw) {
      return { success: false, callId, error: "Call already transcribed" };
    }

    if (!call.recordingUrl) {
      return { success: false, callId, error: "No recording URL available" };
    }

    if (!isDeepgramConfigured()) {
      return { success: false, callId, error: "Deepgram not configured" };
    }

    // Transcribe based on source type
    let result: TranscriptionResult;

    if (call.recordingUrl.startsWith("recordings/") && isS3Configured()) {
      // S3 key - download and transcribe
      const buffer = await downloadRecording(call.recordingUrl);
      result = await transcribeFromBuffer(buffer);
    } else {
      // Direct URL
      result = await transcribeFromUrl(call.recordingUrl);
    }

    // Save transcript to database
    await prisma.call.update({
      where: { id: callId },
      data: {
        transcriptRaw: result.raw,
        transcriptJson: result.segments as unknown as object,
      },
    });

    return {
      success: true,
      callId,
      transcript: {
        raw: result.raw,
        formatted: formatTranscriptAsText(result.segments),
        segments: result.segments,
        clientStatements: extractClientStatements(result.segments),
        duration: result.duration,
        wordCount: result.wordCount,
      },
    };
  } catch (error) {
    console.error(`Error transcribing call ${callId}:`, error);
    return {
      success: false,
      callId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get existing transcript for a call
 */
export async function getCallTranscript(
  callId: string
): Promise<TranscriptionServiceResult> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        transcriptRaw: true,
        transcriptJson: true,
        durationSeconds: true,
      },
    });

    if (!call) {
      return { success: false, callId, error: "Call not found" };
    }

    if (!call.transcriptRaw || !call.transcriptJson) {
      return { success: false, callId, error: "No transcript available" };
    }

    const segments = call.transcriptJson as unknown as TranscriptSegment[];

    return {
      success: true,
      callId,
      transcript: {
        raw: call.transcriptRaw,
        formatted: formatTranscriptAsText(segments),
        segments,
        clientStatements: extractClientStatements(segments),
        duration: call.durationSeconds || 0,
        wordCount: call.transcriptRaw.split(/\s+/).length,
      },
    };
  } catch (error) {
    console.error(`Error getting transcript for call ${callId}:`, error);
    return {
      success: false,
      callId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search transcript for keywords
 */
export async function searchTranscript(
  callId: string,
  keywords: string[]
): Promise<{
  success: boolean;
  matches: Array<{
    keyword: string;
    segments: TranscriptSegment[];
  }>;
}> {
  const transcriptResult = await getCallTranscript(callId);

  if (!transcriptResult.success || !transcriptResult.transcript) {
    return { success: false, matches: [] };
  }

  const matches: Array<{ keyword: string; segments: TranscriptSegment[] }> = [];

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    const matchingSegments = transcriptResult.transcript.segments.filter((s) =>
      s.text.toLowerCase().includes(lowerKeyword)
    );

    if (matchingSegments.length > 0) {
      matches.push({ keyword, segments: matchingSegments });
    }
  }

  return { success: true, matches };
}

/**
 * Get transcript statistics
 */
export async function getTranscriptStats(callId: string): Promise<{
  success: boolean;
  stats?: {
    totalWords: number;
    clientWords: number;
    caseManagerWords: number;
    clientSpeakingTime: number;
    caseManagerSpeakingTime: number;
    totalDuration: number;
    clientSpeakingRatio: number;
  };
}> {
  const transcriptResult = await getCallTranscript(callId);

  if (!transcriptResult.success || !transcriptResult.transcript) {
    return { success: false };
  }

  const segments = transcriptResult.transcript.segments;

  let clientWords = 0;
  let caseManagerWords = 0;
  let clientTime = 0;
  let caseManagerTime = 0;

  for (const segment of segments) {
    const words = segment.text.split(/\s+/).length;
    const duration = segment.endTime - segment.startTime;

    if (segment.speaker === "CLIENT") {
      clientWords += words;
      clientTime += duration;
    } else if (segment.speaker === "CASE_MANAGER") {
      caseManagerWords += words;
      caseManagerTime += duration;
    }
  }

  const totalDuration = transcriptResult.transcript.duration;
  const totalWords = clientWords + caseManagerWords;

  return {
    success: true,
    stats: {
      totalWords,
      clientWords,
      caseManagerWords,
      clientSpeakingTime: Math.round(clientTime),
      caseManagerSpeakingTime: Math.round(caseManagerTime),
      totalDuration: Math.round(totalDuration),
      clientSpeakingRatio:
        totalDuration > 0 ? Math.round((clientTime / totalDuration) * 100) : 0,
    },
  };
}
