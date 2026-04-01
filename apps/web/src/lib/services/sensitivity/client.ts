/**
 * HTTP client for the Sensitivity NLP Service.
 * PX-878: Tiered Content Classifier
 */

import type {
  SensitivityResult,
  TranscriptSegment,
  SensitivityModelInfo,
} from "./types";

/**
 * Client for communicating with the Python NLP service.
 */
export class SensitivityClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(baseUrl: string, apiKey: string, timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = apiKey;
    this.timeout = timeout;
  }

  /**
   * Classify transcript segments into sensitivity tiers.
   */
  async classify(
    segments: TranscriptSegment[],
    orgId: string,
    callId?: string,
    conversationId?: string
  ): Promise<SensitivityResult> {
    const response = await this.fetch("/v1/classify", {
      method: "POST",
      body: JSON.stringify({
        segments: segments.map((s) => ({
          index: s.index,
          start_time: s.startTime,
          end_time: s.endTime,
          text: s.text,
          speaker: s.speaker,
        })),
        org_id: orgId,
        call_id: callId,
        conversation_id: conversationId,
      }),
    });

    const data = await response.json();

    // Transform snake_case to camelCase
    return {
      success: data.success,
      segments: data.segments.map((s: Record<string, unknown>) => ({
        segmentIndex: s.segment_index,
        startTime: s.start_time,
        endTime: s.end_time,
        text: s.text,
        tier: s.tier,
        confidence: s.confidence,
        category: s.category,
        signals: s.signals,
        needsReview: s.needs_review,
        reviewReason: s.review_reason,
      })),
      overallTier: data.overall_tier,
      confidence: data.confidence,
      modelVersion: data.model_version,
      requiresReview: data.requires_review,
      blockReason: data.block_reason,
      processingTimeMs: data.processing_time_ms,
    };
  }

  /**
   * List available model versions.
   */
  async listModels(orgId?: string): Promise<SensitivityModelInfo[]> {
    const url = orgId ? `/v1/models?org_id=${orgId}` : "/v1/models";
    const response = await this.fetch(url);
    const data = await response.json();

    return data.models.map((m: Record<string, unknown>) => ({
      version: m.version,
      orgId: m.org_id,
      isActive: m.is_active,
      accuracy: m.accuracy,
      precision: m.precision,
      recall: m.recall,
      f1Score: m.f1_score,
      trainingSize: m.training_size,
      trainedAt: m.trained_at,
    }));
  }

  /**
   * Trigger model retraining.
   */
  async triggerRetraining(options: {
    jobId: string;
    orgId: string | null;
    force?: boolean;
    reason?: string;
  }): Promise<{ success: boolean; jobId?: string; message: string }> {
    const response = await this.fetch("/v1/train", {
      method: "POST",
      body: JSON.stringify({
        job_id: options.jobId,
        org_id: options.orgId,
        force: options.force,
        reason: options.reason || "MANUAL",
      }),
    });

    const data = await response.json();
    return {
      success: data.success,
      jobId: data.job_id,
      message: data.message,
    };
  }

  /**
   * Notify the NLP service of a model change (e.g., rollback).
   */
  async notifyModelChange(options: {
    orgId: string | null;
    version: string;
    action: "rollback" | "activate";
  }): Promise<{ success: boolean; message: string }> {
    const response = await this.fetch("/v1/models/notify", {
      method: "POST",
      body: JSON.stringify({
        org_id: options.orgId,
        version: options.version,
        action: options.action,
      }),
    });

    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
    };
  }

  /**
   * Rollback to a previous model version.
   */
  async rollback(
    targetVersion: string,
    orgId?: string
  ): Promise<{
    success: boolean;
    previousVersion: string;
    newActiveVersion: string;
    message: string;
  }> {
    const response = await this.fetch("/v1/rollback", {
      method: "POST",
      body: JSON.stringify({
        org_id: orgId,
        target_version: targetVersion,
      }),
    });

    const data = await response.json();
    return {
      success: data.success,
      previousVersion: data.previous_version,
      newActiveVersion: data.new_active_version,
      message: data.message,
    };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{
    status: string;
    modelLoaded: boolean;
    modelVersion?: string;
  }> {
    const response = await this.fetch("/health");
    const data = await response.json();
    return {
      status: data.status,
      modelLoaded: data.model_loaded,
      modelVersion: data.model_version,
    };
  }

  /**
   * Internal fetch wrapper with authentication and error handling.
   */
  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-Service-API-Key": this.apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new SensitivityServiceError(
          error.error?.message || `HTTP ${response.status}`,
          error.error?.code || "SERVICE_ERROR",
          response.status
        );
      }

      return response;
    } catch (error) {
      if (error instanceof SensitivityServiceError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new SensitivityServiceError(
          "Request timeout",
          "TIMEOUT",
          408
        );
      }
      throw new SensitivityServiceError(
        error instanceof Error ? error.message : "Unknown error",
        "NETWORK_ERROR",
        0
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Custom error class for sensitivity service errors.
 */
export class SensitivityServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "SensitivityServiceError";
  }
}

// Singleton instance
let sensitivityClient: SensitivityClient | null = null;

/**
 * Get the sensitivity client singleton.
 */
export function getSensitivityClient(): SensitivityClient {
  if (!sensitivityClient) {
    const baseUrl = process.env.SENSITIVITY_SERVICE_URL;
    const apiKey = process.env.SENSITIVITY_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error(
        "Sensitivity service not configured. " +
        "Set SENSITIVITY_SERVICE_URL and SENSITIVITY_API_KEY environment variables."
      );
    }

    sensitivityClient = new SensitivityClient(baseUrl, apiKey);
  }

  return sensitivityClient;
}

/**
 * Check if sensitivity service is configured.
 */
export function isSensitivityConfigured(): boolean {
  return !!(
    process.env.SENSITIVITY_SERVICE_URL &&
    process.env.SENSITIVITY_API_KEY
  );
}

/**
 * Check if sensitivity detection is enabled.
 * Can be disabled via feature flag.
 */
export function isSensitivityEnabled(): boolean {
  return (
    isSensitivityConfigured() &&
    process.env.SENSITIVITY_ENABLED !== "false"
  );
}
