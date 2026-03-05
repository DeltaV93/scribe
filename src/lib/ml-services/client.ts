/**
 * ML Services API Client
 *
 * Client for communicating with the ml-services FastAPI backend.
 * Used server-side only (API routes, server actions).
 */

import {
  Model,
  ModelCreate,
  ModelUpdate,
  ModelVersion,
  VersionCreate,
  VersionUpdate,
  ModelDeployment,
  DeploymentCreate,
  OrgProfile,
  OrgProfileCreate,
  OrgProfileUpdate,
  PrivacyBudget,
  ComplianceStatus,
  AuditEvent,
  AuditEventCreate,
  Feedback,
  FeedbackCreate,
  FeedbackStats,
  FeedbackExport,
  FeedbackType,
  AggregationPeriod,
  PaginatedResponse,
  MLServiceError,
  MLServiceApiError,
  ModelType,
  IndustryDefault,
  IndustryListResponse,
  Industry,
  // PX-887 Matching types
  DetectionRequest,
  DetectionResponse,
  ScoreRequest,
  ScoreResponse,
  SegmentRequest,
  SegmentResponse,
  MatchRequest,
  MatchResponse,
  // PX-897 Privacy types
  DPQueryRequest,
  DPQueryResponse,
  BudgetConsumption,
  GroupStats,
  // PX-898 Audit types
  AuditExportRequest,
  AuditExportResponse,
  AuditQueueStatus,
  RiskTier,
} from "./types";

// Configuration from environment
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY || "";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  orgId?: string;
  userId?: string;
}

/**
 * Base fetch wrapper with authentication and error handling
 */
async function mlFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, orgId, userId } = options;

  // Build URL with query params
  const url = new URL(`${ML_SERVICE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Service-API-Key": ML_SERVICE_API_KEY,
  };

  if (orgId) {
    headers["X-Org-ID"] = orgId;
  }

  if (userId) {
    headers["X-User-ID"] = userId;
  }

  // Make request
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Disable caching for API calls
    cache: "no-store",
  });

  // Handle errors
  if (!response.ok) {
    let errorData: MLServiceError;
    try {
      errorData = await response.json();
    } catch {
      throw new MLServiceApiError(
        "UNKNOWN_ERROR",
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }
    throw MLServiceApiError.fromResponse(errorData, response.status);
  }

  // Parse response
  return response.json();
}

// ============================================================================
// Model Registry
// ============================================================================

export const models = {
  /**
   * List models with optional filtering
   */
  async list(options?: {
    modelType?: ModelType;
    includeGlobal?: boolean;
    page?: number;
    pageSize?: number;
    orgId?: string;
  }): Promise<PaginatedResponse<Model>> {
    return mlFetch("/v1/models", {
      params: {
        model_type: options?.modelType,
        include_global: options?.includeGlobal,
        page: options?.page,
        page_size: options?.pageSize,
      },
      orgId: options?.orgId,
    });
  },

  /**
   * Get a model by ID
   */
  async get(modelId: string): Promise<Model> {
    return mlFetch(`/v1/models/${modelId}`);
  },

  /**
   * Create a new model
   */
  async create(data: ModelCreate): Promise<Model> {
    return mlFetch("/v1/models", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Update a model
   */
  async update(modelId: string, data: ModelUpdate): Promise<Model> {
    return mlFetch(`/v1/models/${modelId}`, {
      method: "PATCH",
      body: data,
    });
  },
};

// ============================================================================
// Model Versions
// ============================================================================

export const versions = {
  /**
   * List versions for a model
   */
  async list(modelId: string): Promise<{ items: ModelVersion[]; total: number }> {
    return mlFetch(`/v1/models/${modelId}/versions`);
  },

  /**
   * Get a specific version
   */
  async get(modelId: string, versionNumber: number): Promise<ModelVersion> {
    return mlFetch(`/v1/models/${modelId}/versions/${versionNumber}`);
  },

  /**
   * Create a new version
   */
  async create(modelId: string, data: VersionCreate = {}): Promise<ModelVersion> {
    return mlFetch(`/v1/models/${modelId}/versions`, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Update a version
   */
  async update(
    modelId: string,
    versionNumber: number,
    data: VersionUpdate
  ): Promise<ModelVersion> {
    return mlFetch(`/v1/models/${modelId}/versions/${versionNumber}`, {
      method: "PATCH",
      body: data,
    });
  },

  /**
   * Deploy a version
   */
  async deploy(
    modelId: string,
    versionNumber: number,
    data: DeploymentCreate
  ): Promise<ModelDeployment> {
    return mlFetch(`/v1/models/${modelId}/versions/${versionNumber}/deploy`, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Rollback to a specific version
   */
  async rollback(
    modelId: string,
    versionNumber: number,
    environment: "staging" | "production"
  ): Promise<ModelDeployment> {
    return mlFetch(`/v1/models/${modelId}/versions/${versionNumber}/rollback`, {
      method: "POST",
      params: { environment },
    });
  },
};

// ============================================================================
// Org Profile
// ============================================================================

export const orgProfile = {
  /**
   * Get org profile
   */
  async get(orgId: string): Promise<OrgProfile> {
    return mlFetch(`/v1/orgs/${orgId}/profile`);
  },

  /**
   * Create org profile
   */
  async create(orgId: string, data: Omit<OrgProfileCreate, "org_id">): Promise<OrgProfile> {
    return mlFetch(`/v1/orgs/${orgId}/profile`, {
      method: "POST",
      body: { ...data, org_id: orgId },
    });
  },

  /**
   * Update org profile
   */
  async update(orgId: string, data: OrgProfileUpdate): Promise<OrgProfile> {
    return mlFetch(`/v1/orgs/${orgId}/profile`, {
      method: "PUT",
      body: data,
    });
  },

  /**
   * Get privacy budget status
   */
  async getPrivacyBudget(orgId: string): Promise<PrivacyBudget> {
    return mlFetch(`/v1/orgs/${orgId}/privacy/budget`);
  },

  /**
   * Get compliance status
   */
  async getComplianceStatus(orgId: string): Promise<ComplianceStatus> {
    return mlFetch(`/v1/orgs/${orgId}/compliance`);
  },
};

// ============================================================================
// Industry Defaults
// ============================================================================

export const industries = {
  /**
   * List all available industry configurations
   */
  async list(): Promise<IndustryListResponse> {
    return mlFetch("/v1/industries");
  },

  /**
   * Get a specific industry configuration
   */
  async get(industryId: Industry | string): Promise<IndustryDefault> {
    return mlFetch(`/v1/industries/${industryId}`);
  },
};

// ============================================================================
// Audit Events
// ============================================================================

export const audit = {
  /**
   * Create an audit event
   */
  async createEvent(data: AuditEventCreate): Promise<AuditEvent> {
    return mlFetch("/v1/audit/events", {
      method: "POST",
      body: data,
    });
  },

  /**
   * List audit events
   */
  async listEvents(options: {
    orgId: string;
    eventType?: string;
    riskTier?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<AuditEvent>> {
    return mlFetch("/v1/audit/events", {
      params: {
        org_id: options.orgId,
        event_type: options.eventType,
        risk_tier: options.riskTier,
        start_date: options.startDate,
        end_date: options.endDate,
        page: options.page,
        page_size: options.pageSize,
      },
    });
  },

  /**
   * Get a specific audit event
   */
  async getEvent(eventId: string): Promise<AuditEvent> {
    return mlFetch(`/v1/audit/events/${eventId}`);
  },
};

// ============================================================================
// Feedback
// ============================================================================

export const feedback = {
  /**
   * Submit feedback on a model output
   */
  async submit(data: FeedbackCreate, orgId: string, userId: string): Promise<Feedback> {
    return mlFetch("/v1/feedback", {
      method: "POST",
      body: data,
      orgId,
      userId,
    });
  },

  /**
   * List feedback with filtering
   */
  async list(options: {
    orgId: string;
    modelId?: string;
    versionId?: string;
    feedbackType?: FeedbackType;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<Feedback>> {
    return mlFetch("/v1/feedback", {
      params: {
        model_id: options.modelId,
        version_id: options.versionId,
        feedback_type: options.feedbackType,
        start_date: options.startDate,
        end_date: options.endDate,
        page: options.page,
        page_size: options.pageSize,
      },
      orgId: options.orgId,
    });
  },

  /**
   * Get feedback by ID
   */
  async get(feedbackId: string, orgId: string): Promise<Feedback> {
    return mlFetch(`/v1/feedback/${feedbackId}`, {
      orgId,
    });
  },

  /**
   * Delete feedback
   */
  async delete(feedbackId: string, orgId: string): Promise<void> {
    return mlFetch(`/v1/feedback/${feedbackId}`, {
      method: "DELETE",
      orgId,
    });
  },

  /**
   * Get feedback statistics for a model
   */
  async getStats(options: {
    modelId: string;
    versionId?: string;
    period?: AggregationPeriod;
    limit?: number;
    orgId: string;
  }): Promise<FeedbackStats> {
    return mlFetch(`/v1/feedback/stats/${options.modelId}`, {
      params: {
        version_id: options.versionId,
        period: options.period,
        limit: options.limit,
      },
      orgId: options.orgId,
    });
  },

  /**
   * Export feedback for retraining
   */
  async export(options: {
    modelId: string;
    versionId?: string;
    feedbackTypes?: FeedbackType[];
    startDate?: string;
    endDate?: string;
    limit?: number;
    orgId: string;
  }): Promise<FeedbackExport> {
    return mlFetch(`/v1/feedback/export/${options.modelId}`, {
      params: {
        version_id: options.versionId,
        feedback_types: options.feedbackTypes?.join(","),
        start_date: options.startDate,
        end_date: options.endDate,
        limit: options.limit,
      },
      orgId: options.orgId,
    });
  },
};

// ============================================================================
// Matching (PX-887)
// ============================================================================

export const matching = {
  /**
   * Detect signals in text
   */
  async detect(data: DetectionRequest): Promise<DetectionResponse> {
    return mlFetch("/v1/matching/detect", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Calculate confidence score for a form match
   */
  async score(data: ScoreRequest): Promise<ScoreResponse> {
    return mlFetch("/v1/matching/score", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Detect meeting segments in transcript
   */
  async detectSegments(data: SegmentRequest): Promise<SegmentResponse> {
    return mlFetch("/v1/matching/segments", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Match transcript to forms
   */
  async matchForms(data: MatchRequest): Promise<MatchResponse> {
    return mlFetch("/v1/matching/match", {
      method: "POST",
      body: data,
    });
  },
};

// ============================================================================
// Privacy (PX-897)
// ============================================================================

export const privacy = {
  /**
   * Get privacy budget for an organization
   */
  async getBudget(orgId: string): Promise<PrivacyBudget> {
    return mlFetch(`/v1/privacy/budget/${orgId}`);
  },

  /**
   * Consume privacy budget
   */
  async consumeBudget(
    orgId: string,
    epsilon: number,
    purpose: string
  ): Promise<BudgetConsumption> {
    return mlFetch(`/v1/privacy/budget/${orgId}/consume`, {
      method: "POST",
      body: { epsilon_amount: epsilon, purpose },
    });
  },

  /**
   * Execute a differentially private query
   */
  async query(data: DPQueryRequest): Promise<DPQueryResponse> {
    return mlFetch("/v1/privacy/query", {
      method: "POST",
      body: data,
    });
  },

  /**
   * List grouping keys with statistics
   */
  async listGroups(orgId: string): Promise<{ groups: GroupStats[]; total: number }> {
    return mlFetch(`/v1/privacy/groups/${orgId}`);
  },

  /**
   * Check privacy service health
   */
  async checkHealth(): Promise<{ status: string; opendp_available: boolean }> {
    return mlFetch("/v1/privacy/health");
  },
};

// ============================================================================
// Audit (PX-898 Enhanced)
// ============================================================================

export const auditEnhanced = {
  /**
   * Create audit event with automatic risk tier detection
   */
  async createEventAutoTier(
    data: Omit<AuditEventCreate, "risk_tier"> & { model_id?: string }
  ): Promise<AuditEvent & { routing_decision: { source: string; reason: string } }> {
    return mlFetch("/v1/audit/events/auto-tier", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Request an audit export
   */
  async requestExport(data: AuditExportRequest): Promise<AuditExportResponse> {
    return mlFetch("/v1/audit/export", {
      method: "POST",
      body: data,
    });
  },

  /**
   * Check export job status
   */
  async getExportStatus(jobId: string): Promise<AuditExportResponse> {
    return mlFetch(`/v1/audit/export/${jobId}`);
  },

  /**
   * Get audit queue status
   */
  async getQueueStatus(): Promise<AuditQueueStatus> {
    return mlFetch("/v1/audit/queue/status");
  },

  /**
   * List events with risk tier filtering
   */
  async listByRiskTier(options: {
    orgId: string;
    riskTier?: RiskTier;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<AuditEvent>> {
    return mlFetch("/v1/audit/events", {
      params: {
        org_id: options.orgId,
        risk_tier: options.riskTier,
        event_type: options.eventType,
        start_date: options.startDate,
        end_date: options.endDate,
        page: options.page,
        page_size: options.pageSize,
      },
    });
  },
};

// ============================================================================
// Health & Utility
// ============================================================================

export const health = {
  /**
   * Check if ml-services is healthy
   */
  async check(): Promise<{ status: string }> {
    return mlFetch("/healthz");
  },

  /**
   * Check readiness (db + redis connected)
   */
  async ready(): Promise<{ status: string; db: string; redis: string }> {
    return mlFetch("/readyz");
  },
};

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Emit a model deployment audit event
 */
export async function emitModelDeployed(
  orgId: string,
  modelId: string,
  versionId: string,
  environment: string,
  actorId: string
): Promise<AuditEvent> {
  return audit.createEvent({
    org_id: orgId,
    event_type: "model.deployed",
    risk_tier: "medium",
    actor_id: actorId,
    actor_type: "user",
    event_data: {
      model_id: modelId,
      version_id: versionId,
      environment,
    },
    source_service: "inkra-nextjs",
    occurred_at: new Date().toISOString(),
  });
}

/**
 * Emit a model rollback audit event
 */
export async function emitModelRollback(
  orgId: string,
  modelId: string,
  fromVersion: number,
  toVersion: number,
  environment: string,
  actorId: string
): Promise<AuditEvent> {
  return audit.createEvent({
    org_id: orgId,
    event_type: "model.rollback",
    risk_tier: "high",
    actor_id: actorId,
    actor_type: "user",
    event_data: {
      model_id: modelId,
      from_version: fromVersion,
      to_version: toVersion,
      environment,
    },
    source_service: "inkra-nextjs",
    occurred_at: new Date().toISOString(),
  });
}

/**
 * Check if org has privacy budget available
 */
export async function hasPrivacyBudget(orgId: string): Promise<boolean> {
  try {
    const budget = await orgProfile.getPrivacyBudget(orgId);
    return !budget.is_exhausted;
  } catch (error) {
    // If org profile doesn't exist, assume budget is available
    if (error instanceof MLServiceApiError && error.code === "ORG_PROFILE_NOT_FOUND") {
      return true;
    }
    throw error;
  }
}

// Default export for convenience
const mlServices = {
  models,
  versions,
  orgProfile,
  industries,
  audit,
  auditEnhanced,
  feedback,
  matching,
  privacy,
  health,
  emitModelDeployed,
  emitModelRollback,
  hasPrivacyBudget,
};

export default mlServices;
