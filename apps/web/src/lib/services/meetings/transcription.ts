/**
 * Meeting Transcription Service
 *
 * Handles audio transcription with speaker diarization.
 * Supports Deepgram (primary) and Whisper (fallback).
 */

import { TranscriptResult, TranscriptSegment, TranscriptionOptions } from "./types";

// ============================================
// DEEPGRAM TRANSCRIPTION
// ============================================

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramResponse {
  results: {
    channels: DeepgramChannel[];
  };
  metadata: {
    duration: number;
    models: string[];
  };
}

/**
 * Transcribe audio using Deepgram
 */
export async function transcribeWithDeepgram(
  audioBuffer: Buffer,
  options: TranscriptionOptions = {}
): Promise<TranscriptResult> {
  const startTime = Date.now();

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const {
    language = "en",
    speakerDiarization = true,
    maxSpeakers = 10,
  } = options;

  // Build query parameters
  const params = new URLSearchParams({
    model: "nova-2",
    language,
    punctuate: "true",
    utterances: "true",
    smart_format: "true",
  });

  if (speakerDiarization) {
    params.set("diarize", "true");
    params.set("diarize_version", "3");
    if (maxSpeakers) {
      params.set("diarize_max_speakers", String(maxSpeakers));
    }
  }

  // Convert Buffer to Uint8Array for fetch compatibility
  const bodyData = new Uint8Array(audioBuffer);

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/wav", // Adjust based on actual format
      },
      body: bodyData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${error}`);
  }

  const data: DeepgramResponse = await response.json();

  // Process the response
  const channel = data.results.channels[0];
  const alternative = channel?.alternatives[0];

  if (!alternative) {
    throw new Error("No transcription result from Deepgram");
  }

  const fullText = alternative.transcript;
  const words = alternative.words || [];

  // Build speaker-diarized segments
  const segments = buildSegmentsFromWords(words);

  const processingTimeMs = Date.now() - startTime;

  return {
    fullText,
    segments,
    wordCount: words.length,
    language,
    transcriptionModel: "deepgram-nova-2",
    processingTimeMs,
  };
}

/**
 * Build speaker segments from word-level data
 */
function buildSegmentsFromWords(words: DeepgramWord[]): TranscriptSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptSegment | null = null;

  for (const word of words) {
    const speakerId = String(word.speaker ?? 0);

    if (!currentSegment || currentSegment.speakerId !== speakerId) {
      // Start new segment
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        speakerId,
        speakerName: `Speaker ${parseInt(speakerId) + 1}`,
        startTime: word.start,
        endTime: word.end,
        text: word.word,
        confidence: word.confidence,
      };
    } else {
      // Continue current segment
      currentSegment.endTime = word.end;
      currentSegment.text += " " + word.word;
      // Average confidence
      currentSegment.confidence = currentSegment.confidence
        ? (currentSegment.confidence + word.confidence) / 2
        : word.confidence;
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

// ============================================
// WHISPER TRANSCRIPTION (FALLBACK)
// ============================================

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeWithWhisper(
  audioBuffer: Buffer,
  options: TranscriptionOptions = {}
): Promise<TranscriptResult> {
  const startTime = Date.now();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for Whisper");
  }

  const { language = "en" } = options;

  // Create form data with the audio file
  const formData = new FormData();
  const arrayBuffer = new Uint8Array(audioBuffer);
  const blob = new Blob([arrayBuffer], { type: "audio/wav" });
  formData.append("file", blob, "audio.wav");
  formData.append("model", "whisper-1");
  formData.append("language", language);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Whisper API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  const processingTimeMs = Date.now() - startTime;

  // Whisper doesn't provide speaker diarization natively
  // Create a single segment for the full transcript
  const segments: TranscriptSegment[] = [
    {
      speakerId: "0",
      speakerName: "Speaker",
      startTime: 0,
      endTime: data.duration || 0,
      text: data.text,
    },
  ];

  return {
    fullText: data.text,
    segments,
    wordCount: data.text.split(/\s+/).length,
    language,
    transcriptionModel: "whisper-large-v3",
    processingTimeMs,
  };
}

// ============================================
// UNIFIED TRANSCRIPTION
// ============================================

/**
 * Transcribe audio using the best available service
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: TranscriptionOptions = {}
): Promise<TranscriptResult> {
  const preferredModel = options.model || "deepgram-nova-2";

  // Try Deepgram first (better speaker diarization)
  if (preferredModel === "deepgram-nova-2" && process.env.DEEPGRAM_API_KEY) {
    try {
      return await transcribeWithDeepgram(audioBuffer, options);
    } catch (error) {
      console.error("Deepgram transcription failed, falling back to Whisper:", error);
    }
  }

  // Fallback to Whisper
  if (process.env.OPENAI_API_KEY) {
    return await transcribeWithWhisper(audioBuffer, options);
  }

  throw new Error("No transcription service available. Configure DEEPGRAM_API_KEY or OPENAI_API_KEY.");
}

// ============================================
// SPEAKER IDENTIFICATION
// ============================================

/**
 * Attempt to match speaker IDs to participant names
 * Uses voice patterns from early introductions in the meeting
 */
export function matchSpeakersToParticipants(
  segments: TranscriptSegment[],
  participants: Array<{ name: string; email?: string }>
): TranscriptSegment[] {
  // Look for introduction patterns in first few segments
  const introPatterns = [
    /(?:hi|hello|hey),?\s*(?:this is|i'm|i am)\s+(\w+)/i,
    /(\w+)\s+(?:here|speaking)/i,
    /(?:it's|its)\s+(\w+)/i,
  ];

  const speakerNameMap = new Map<string, string>();

  // Search early segments for speaker introductions
  const earlySegments = segments.slice(0, Math.min(segments.length, 20));

  for (const segment of earlySegments) {
    if (speakerNameMap.has(segment.speakerId)) continue;

    for (const pattern of introPatterns) {
      const match = segment.text.match(pattern);
      if (match) {
        const mentionedName = match[1].toLowerCase();

        // Try to match to a participant
        const matchedParticipant = participants.find(
          (p) => p.name.toLowerCase().includes(mentionedName) ||
            mentionedName.includes(p.name.toLowerCase().split(" ")[0])
        );

        if (matchedParticipant) {
          speakerNameMap.set(segment.speakerId, matchedParticipant.name);
          break;
        }
      }
    }
  }

  // Apply speaker names to all segments
  return segments.map((segment) => ({
    ...segment,
    speakerName: speakerNameMap.get(segment.speakerId) || segment.speakerName,
  }));
}

// ============================================
// TRANSCRIPT FORMATTING
// ============================================

/**
 * Format transcript segments into readable text
 */
export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => {
      const timestamp = formatTimestamp(segment.startTime);
      return `[${timestamp}] ${segment.speakerName || "Speaker"}: ${segment.text}`;
    })
    .join("\n\n");
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
