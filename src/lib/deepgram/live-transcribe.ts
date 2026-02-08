import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { TranscriptSegment } from "./transcribe";

// ============================================
// TYPES
// ============================================

export interface LiveTranscriptEvent {
  type: "transcript" | "utterance_end" | "error" | "close";
  segment?: {
    speaker: "CASE_MANAGER" | "CLIENT" | "UNCERTAIN";
    text: string;
    startTime: number;
    endTime: number;
    confidence: number;
    isFinal: boolean;
  };
  error?: string;
}

export interface LiveTranscriptionOptions {
  onTranscript: (event: LiveTranscriptEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  speakerLabels?: boolean;
  language?: string;
}

export interface LiveTranscriptionConnection {
  send: (audioData: ArrayBuffer | ArrayBufferLike | Blob) => void;
  close: () => void;
  isConnected: () => boolean;
}

// ============================================
// LIVE TRANSCRIPTION SERVICE
// ============================================

/**
 * Create a live transcription connection to Deepgram
 * Used for real-time transcription during active calls
 */
export function createLiveTranscription(
  options: LiveTranscriptionOptions
): LiveTranscriptionConnection {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY not configured");
  }

  const client = createClient(apiKey);
  let isConnected = false;
  let connection: ReturnType<typeof client.listen.live> | null = null;

  // Create live transcription connection
  connection = client.listen.live({
    model: "nova-2",
    language: options.language || "en-US",
    smart_format: true,
    punctuate: true,
    diarize: options.speakerLabels !== false, // Enable by default
    interim_results: true, // Get partial results
    utterance_end_ms: 1000, // Detect end of utterance after 1s silence
    vad_events: true, // Voice activity detection
    encoding: "mulaw", // Twilio uses mulaw encoding
    sample_rate: 8000, // Twilio sample rate
    channels: 1,
  });

  // Handle events
  connection.on(LiveTranscriptionEvents.Open, () => {
    isConnected = true;
    console.log("[Deepgram] Live connection opened");
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    isConnected = false;
    console.log("[Deepgram] Live connection closed");
    options.onClose?.();
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error("[Deepgram] Error:", error);
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
    options.onTranscript({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    try {
      const channel = data.channel;
      const alternatives = channel?.alternatives;

      if (!alternatives || alternatives.length === 0) {
        return;
      }

      const alternative = alternatives[0];
      const transcript = alternative.transcript;

      // Skip empty transcripts
      if (!transcript || transcript.trim() === "") {
        return;
      }

      // Determine speaker from channel/speaker data
      const speakerNum = data.channel_index?.[0] ?? 0;
      let speaker: "CASE_MANAGER" | "CLIENT" | "UNCERTAIN";
      if (speakerNum === 0) {
        speaker = "CASE_MANAGER";
      } else if (speakerNum === 1) {
        speaker = "CLIENT";
      } else {
        speaker = "UNCERTAIN";
      }

      // Calculate timing
      const words = alternative.words || [];
      const startTime = words.length > 0 ? words[0].start : 0;
      const endTime = words.length > 0 ? words[words.length - 1].end : 0;

      options.onTranscript({
        type: "transcript",
        segment: {
          speaker,
          text: transcript,
          startTime,
          endTime,
          confidence: alternative.confidence || 0,
          isFinal: data.is_final || false,
        },
      });
    } catch (error) {
      console.error("[Deepgram] Error processing transcript:", error);
    }
  });

  connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
    options.onTranscript({
      type: "utterance_end",
    });
  });

  return {
    send: (audioData: ArrayBuffer | ArrayBufferLike | Blob) => {
      if (connection && isConnected) {
        connection.send(audioData);
      }
    },
    close: () => {
      if (connection) {
        connection.finish();
        isConnected = false;
      }
    },
    isConnected: () => isConnected,
  };
}

// ============================================
// TRANSCRIPT ACCUMULATOR
// ============================================

/**
 * Accumulates live transcript segments into a complete transcript
 * Handles interim results and final segments
 */
export class TranscriptAccumulator {
  private finalSegments: TranscriptSegment[] = [];
  private currentInterim: LiveTranscriptEvent["segment"] | null = null;

  /**
   * Process a transcript event
   */
  processEvent(event: LiveTranscriptEvent): TranscriptSegment[] | null {
    if (event.type !== "transcript" || !event.segment) {
      return null;
    }

    const segment = event.segment;

    if (segment.isFinal) {
      // Add to final segments
      this.finalSegments.push({
        speaker: segment.speaker,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        confidence: segment.confidence,
        words: [], // Words not available in live mode
      });
      this.currentInterim = null;
      return this.finalSegments;
    } else {
      // Update interim
      this.currentInterim = segment;
      return null;
    }
  }

  /**
   * Get all segments including current interim
   */
  getAllSegments(): TranscriptSegment[] {
    const segments = [...this.finalSegments];
    if (this.currentInterim) {
      segments.push({
        speaker: this.currentInterim.speaker,
        text: this.currentInterim.text,
        startTime: this.currentInterim.startTime,
        endTime: this.currentInterim.endTime,
        confidence: this.currentInterim.confidence,
        words: [],
      });
    }
    return segments;
  }

  /**
   * Get final segments only
   */
  getFinalSegments(): TranscriptSegment[] {
    return [...this.finalSegments];
  }

  /**
   * Get current interim segment
   */
  getCurrentInterim(): LiveTranscriptEvent["segment"] | null {
    return this.currentInterim;
  }

  /**
   * Get full transcript as text
   */
  getFullTranscript(): string {
    return this.finalSegments.map((s) => s.text).join(" ");
  }

  /**
   * Reset accumulator
   */
  reset(): void {
    this.finalSegments = [];
    this.currentInterim = null;
  }
}

// ============================================
// CALL TRANSCRIPT STORE
// ============================================

/**
 * In-memory store for active call transcripts
 * Used to accumulate transcripts during calls
 */
const activeCallTranscripts = new Map<string, TranscriptAccumulator>();

/**
 * Get or create accumulator for a call
 */
export function getCallTranscriptAccumulator(callId: string): TranscriptAccumulator {
  let accumulator = activeCallTranscripts.get(callId);
  if (!accumulator) {
    accumulator = new TranscriptAccumulator();
    activeCallTranscripts.set(callId, accumulator);
  }
  return accumulator;
}

/**
 * Get current transcript for a call
 */
export function getCallTranscript(callId: string): TranscriptSegment[] {
  const accumulator = activeCallTranscripts.get(callId);
  return accumulator ? accumulator.getAllSegments() : [];
}

/**
 * Clear transcript for a call (when call ends)
 */
export function clearCallTranscript(callId: string): TranscriptSegment[] {
  const accumulator = activeCallTranscripts.get(callId);
  const segments = accumulator ? accumulator.getFinalSegments() : [];
  activeCallTranscripts.delete(callId);
  return segments;
}
