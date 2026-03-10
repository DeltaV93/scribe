/**
 * Web Recording Library (PX-865)
 * MediaRecorder API wrapper for in-person conversation capture
 */

export interface WebRecorderConfig {
  mimeType?: "audio/webm" | "audio/mp4" | "audio/ogg";
  audioBitsPerSecond?: number;
  timeslice?: number; // ms between data chunks
  onDataAvailable?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: RecordingState) => void;
  onAudioLevel?: (level: number) => void;
}

export type RecordingState = "inactive" | "recording" | "paused" | "error";

export interface RecorderResult {
  blob: Blob;
  duration: number; // seconds
  mimeType: string;
}

// Audio level analyzer for visualization
class AudioLevelAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;
  private onLevel: ((level: number) => void) | null = null;

  connect(stream: MediaStream, onLevel: (level: number) => void): void {
    this.onLevel = onLevel;
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.startAnalysis();
  }

  private startAnalysis(): void {
    if (!this.analyser || !this.dataArray || !this.onLevel) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.analyser.getByteFrequencyData(this.dataArray as any);
    const average =
      Array.from(this.dataArray).reduce((sum, val) => sum + val, 0) / this.dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);
    this.onLevel(normalizedLevel);

    this.animationFrame = requestAnimationFrame(() => this.startAnalysis());
  }

  disconnect(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
  }
}

/**
 * Check if MediaRecorder is supported in the current browser
 */
export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia !== "undefined"
  );
}

/**
 * Get the best supported MIME type for recording
 */
export function getBestMimeType(): string {
  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "audio/webm"; // Fallback
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    // Fallback: try to get user media to trigger permission prompt
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return "granted";
    } catch {
      return "denied";
    }
  }
}

/**
 * WebRecorder class - wraps MediaRecorder API with enhanced features
 */
export class WebRecorder {
  private config: Required<WebRecorderConfig>;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private state: RecordingState = "inactive";
  private audioAnalyzer: AudioLevelAnalyzer;

  constructor(config: WebRecorderConfig = {}) {
    this.config = {
      mimeType: config.mimeType || (getBestMimeType() as "audio/webm"),
      audioBitsPerSecond: config.audioBitsPerSecond || 128000,
      timeslice: config.timeslice || 1000, // 1 second chunks
      onDataAvailable: config.onDataAvailable || (() => {}),
      onError: config.onError || console.error,
      onStateChange: config.onStateChange || (() => {}),
      onAudioLevel: config.onAudioLevel || (() => {}),
    };
    this.audioAnalyzer = new AudioLevelAnalyzer();
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get current recording duration in seconds
   */
  getDuration(): number {
    if (this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  private setState(newState: RecordingState): void {
    this.state = newState;
    this.config.onStateChange(newState);
  }

  /**
   * Start recording
   */
  async start(): Promise<void> {
    if (this.state === "recording") {
      throw new Error("Already recording");
    }

    try {
      // Request microphone access with audio processing options
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      // Set up audio level analyzer
      this.audioAnalyzer.connect(this.stream, this.config.onAudioLevel);

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.config.mimeType,
        audioBitsPerSecond: this.config.audioBitsPerSecond,
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          this.config.onDataAvailable(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        const error =
          event instanceof ErrorEvent
            ? new Error(event.message)
            : new Error("Recording error");
        this.config.onError(error);
        this.setState("error");
      };

      this.mediaRecorder.onstop = () => {
        if (this.state !== "error") {
          this.setState("inactive");
        }
      };

      // Reset state
      this.chunks = [];
      this.startTime = Date.now();

      // Start recording with timeslice for progressive data
      this.mediaRecorder.start(this.config.timeslice);
      this.setState("recording");
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to start recording");
      this.config.onError(err);
      this.setState("error");
      throw err;
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder && this.state === "recording") {
      this.mediaRecorder.pause();
      this.setState("paused");
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder && this.state === "paused") {
      this.mediaRecorder.resume();
      this.setState("recording");
    }
  }

  /**
   * Stop recording and return the recorded audio
   */
  async stop(): Promise<RecorderResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }

      if (this.state === "inactive") {
        reject(new Error("Recording already stopped"));
        return;
      }

      const duration = this.getDuration();

      this.mediaRecorder.onstop = () => {
        // Disconnect audio analyzer
        this.audioAnalyzer.disconnect();

        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        // Combine chunks into final blob
        const blob = new Blob(this.chunks, { type: this.config.mimeType });

        // Reset state
        this.chunks = [];
        this.startTime = 0;
        this.setState("inactive");

        resolve({
          blob,
          duration,
          mimeType: this.config.mimeType,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording and discard data
   */
  cancel(): void {
    if (this.mediaRecorder && this.state !== "inactive") {
      this.mediaRecorder.stop();
      this.audioAnalyzer.disconnect();

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      this.chunks = [];
      this.startTime = 0;
      this.setState("inactive");
    }
  }

  /**
   * Destroy the recorder and release all resources
   */
  destroy(): void {
    this.cancel();
    this.mediaRecorder = null;
  }
}

// Export singleton factory for React hook usage
let recorderInstance: WebRecorder | null = null;

export function getRecorder(config?: WebRecorderConfig): WebRecorder {
  if (!recorderInstance) {
    recorderInstance = new WebRecorder(config);
  }
  return recorderInstance;
}

export function resetRecorder(): void {
  if (recorderInstance) {
    recorderInstance.destroy();
    recorderInstance = null;
  }
}
