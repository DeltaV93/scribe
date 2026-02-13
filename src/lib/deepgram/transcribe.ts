import { getDeepgramClient } from "./client";

export interface TranscriptSegment {
  speaker: "CASE_MANAGER" | "CLIENT" | "UNCERTAIN";
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface TranscriptionResult {
  raw: string;
  segments: TranscriptSegment[];
  duration: number;
  wordCount: number;
  speakerCount: number;
}

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  words: DeepgramWord[];
  speaker?: number;
  id?: string;
}

/**
 * Transcribe audio from a URL using Deepgram
 */
export async function transcribeFromUrl(
  audioUrl: string
): Promise<TranscriptionResult> {
  const client = getDeepgramClient();

  const response = await client.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      diarize: true,
      utterances: true,
      paragraphs: true,
    }
  );

  return parseDeepgramResponse(response.result);
}

/**
 * Transcribe audio from a buffer using Deepgram
 */
export async function transcribeFromBuffer(
  audioBuffer: Buffer,
  mimeType: string = "audio/mp3"
): Promise<TranscriptionResult> {
  const client = getDeepgramClient();

  const response = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      diarize: true,
      utterances: true,
      paragraphs: true,
      mimetype: mimeType,
    }
  );

  return parseDeepgramResponse(response.result);
}

/**
 * Parse Deepgram response into our transcript format
 */
function parseDeepgramResponse(result: unknown): TranscriptionResult {
  // Handle null or undefined result
  if (!result) {
    console.warn("Deepgram returned null/undefined result");
    return {
      raw: "",
      segments: [],
      duration: 0,
      wordCount: 0,
      speakerCount: 0,
    };
  }

  const data = result as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
          words?: DeepgramWord[];
        }>;
      }>;
      utterances?: DeepgramUtterance[];
    };
    metadata?: {
      duration?: number;
    };
  };

  // Handle missing results
  if (!data.results) {
    console.warn("Deepgram response missing results:", JSON.stringify(data).slice(0, 500));
    return {
      raw: "",
      segments: [],
      duration: data.metadata?.duration || 0,
      wordCount: 0,
      speakerCount: 0,
    };
  }

  const channel = data.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const utterances = data.results?.utterances || [];

  // Get raw transcript
  const raw = alternative?.transcript || "";

  // Get duration
  const duration = data.metadata?.duration || 0;

  // Map utterances to segments with speaker labels
  const segments = mapUtterancesToSegments(utterances);

  // Count words and speakers
  const wordCount = alternative?.words?.length || 0;
  const speakers = new Set(segments.map((s) => s.speaker));
  const speakerCount = speakers.size;

  return {
    raw,
    segments,
    duration,
    wordCount,
    speakerCount,
  };
}

/**
 * Map Deepgram utterances to transcript segments with speaker labels
 */
function mapUtterancesToSegments(
  utterances: DeepgramUtterance[]
): TranscriptSegment[] {
  // First, identify speakers
  // Typically in a call, speaker 0 is the one who initiated (case manager)
  // and speaker 1 is the recipient (client)
  // This can be refined based on call direction or other heuristics

  return utterances.map((utterance) => {
    const speakerNum = utterance.speaker ?? 0;

    // Map speaker number to role
    // Speaker 0 = Case Manager (caller), Speaker 1 = Client
    // This is a simplified heuristic - in production, you might use
    // additional signals like phone number matching
    let speaker: "CASE_MANAGER" | "CLIENT" | "UNCERTAIN";
    if (speakerNum === 0) {
      speaker = "CASE_MANAGER";
    } else if (speakerNum === 1) {
      speaker = "CLIENT";
    } else {
      speaker = "UNCERTAIN";
    }

    return {
      speaker,
      text: utterance.transcript,
      startTime: utterance.start,
      endTime: utterance.end,
      confidence: utterance.confidence,
      words: utterance.words.map((w) => ({
        word: w.punctuated_word || w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
    };
  });
}

/**
 * Format transcript segments as readable text
 */
export function formatTranscriptAsText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const speakerLabel =
        segment.speaker === "CASE_MANAGER"
          ? "Case Manager"
          : segment.speaker === "CLIENT"
            ? "Client"
            : "Unknown";
      return `[${speakerLabel}]: ${segment.text}`;
    })
    .join("\n\n");
}

/**
 * Extract client statements only (useful for form extraction)
 */
export function extractClientStatements(
  segments: TranscriptSegment[]
): string {
  return segments
    .filter((s) => s.speaker === "CLIENT")
    .map((s) => s.text)
    .join(" ");
}

/**
 * Get conversation context around a specific timestamp
 */
export function getContextAroundTimestamp(
  segments: TranscriptSegment[],
  timestamp: number,
  windowSeconds: number = 30
): TranscriptSegment[] {
  return segments.filter(
    (s) =>
      s.startTime >= timestamp - windowSeconds &&
      s.endTime <= timestamp + windowSeconds
  );
}
