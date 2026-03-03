/**
 * ML Services API Types
 *
 * TypeScript types matching the ml-services Python API schemas.
 */

// === Model Registry ===

export type ModelType = "llm" | "extraction" | "classification";

export type VersionStatus =
  | "training"
  | "validating"
  | "ready"
  | "deployed"
  | "deprecated";

export type DeploymentStatus = "pending" | "active" | "draining" | "terminated";

export interface Model {
  id: string;
  name: string;
  model_type: ModelType;
  description: string | null;
  is_global: boolean;
  org_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelCreate {
  name: string;
  model_type: ModelType;
  description?: string;
  is_global?: boolean;
  org_id?: string;
}

export interface ModelUpdate {
  name?: string;
  description?: string;
}

export interface ModelVersion {
  id: string;
  model_id: string;
  version_number: number;
  status: VersionStatus;
  artifact_s3_path: string | null;
  config: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
  deployed_at: string | null;
}

export interface VersionCreate {
  config?: Record<string, unknown>;
  artifact_s3_path?: string;
  parent_version_id?: string;
}

export interface VersionUpdate {
  status?: VersionStatus;
  artifact_s3_path?: string;
  config?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}

export interface ModelDeployment {
  id: string;
  version_id: string;
  environment: "staging" | "production";
  deployment_status: DeploymentStatus;
  traffic_percentage: number;
  started_at: string;
  ended_at: string | null;
}

export interface DeploymentCreate {
  environment: "staging" | "production";
  traffic_percentage?: number;
}

// === Org Profile ===

export interface OrgProfile {
  id: string;
  org_id: string;
  compliance_frameworks: string[];
  retention_policies: Record<string, string>;
  privacy_settings: Record<string, unknown>;
  epsilon_budget: number;
  epsilon_consumed: number;
  budget_reset_at: string | null;
  model_training_enabled: boolean;
  audit_routing_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgProfileCreate {
  org_id: string;
  compliance_frameworks?: string[];
  retention_policies?: Record<string, string>;
  privacy_settings?: Record<string, unknown>;
  epsilon_budget?: number;
  model_training_enabled?: boolean;
  audit_routing_config?: Record<string, unknown>;
}

export interface OrgProfileUpdate {
  compliance_frameworks?: string[];
  retention_policies?: Record<string, string>;
  privacy_settings?: Record<string, unknown>;
  epsilon_budget?: number;
  model_training_enabled?: boolean;
  audit_routing_config?: Record<string, unknown>;
}

export interface PrivacyBudget {
  org_id: string;
  epsilon_budget: number;
  epsilon_consumed: number;
  epsilon_remaining: number;
  budget_reset_at: string | null;
  is_exhausted: boolean;
}

export interface ComplianceStatus {
  org_id: string;
  frameworks: string[];
  overrides_count: number;
  last_audit_at: string | null;
}

// === Audit ===

export type RiskTier = "low" | "medium" | "high" | "critical";
export type ActorType = "user" | "system" | "model";

export interface AuditEvent {
  id: string;
  org_id: string;
  event_type: string;
  risk_tier: RiskTier;
  actor_id: string | null;
  actor_type: ActorType;
  event_data: Record<string, unknown>;
  source_service: string;
  correlation_id: string | null;
  occurred_at: string;
  ingested_at: string;
  s3_archive_path: string | null;
}

export interface AuditEventCreate {
  org_id: string;
  event_type: string;
  risk_tier: RiskTier;
  actor_id?: string;
  actor_type: ActorType;
  event_data?: Record<string, unknown>;
  source_service: string;
  correlation_id?: string;
  occurred_at: string;
}

// === Feedback ===

export type FeedbackType = "thumbs_up" | "thumbs_down" | "correction" | "comment";
export type AggregationPeriod = "day" | "week" | "month";

export interface Feedback {
  id: string;
  org_id: string;
  model_id: string;
  version_id: string | null;
  user_id: string;
  feedback_type: FeedbackType;
  rating: number | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  corrected_output: Record<string, unknown> | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackCreate {
  model_id: string;
  version_id?: string;
  feedback_type: FeedbackType;
  rating?: number;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  corrected_output?: Record<string, unknown>;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackAggregate {
  id: string;
  model_id: string;
  version_id: string | null;
  period: AggregationPeriod;
  period_start: string;
  period_end: string;
  total_count: number;
  positive_count: number;
  negative_count: number;
  correction_count: number;
  comment_count: number;
  avg_rating: number | null;
  rating_count: number;
  computed_at: string;
}

export interface FeedbackStats {
  model_id: string;
  version_id: string | null;
  aggregates: FeedbackAggregate[];
  total_feedback: number;
  total_positive: number;
  total_negative: number;
  total_corrections: number;
  overall_positive_rate: number;
}

export interface FeedbackExportItem {
  id: string;
  feedback_type: FeedbackType;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  corrected_output: Record<string, unknown> | null;
  rating: number | null;
  created_at: string;
}

export interface FeedbackExport {
  model_id: string;
  version_id: string | null;
  items: FeedbackExportItem[];
  total: number;
  exported_at: string;
}

// === Pagination ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// === Errors ===

export interface MLServiceError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id: string;
}

export class MLServiceApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>,
    public requestId?: string
  ) {
    super(message);
    this.name = "MLServiceApiError";
  }

  static fromResponse(response: MLServiceError, statusCode: number): MLServiceApiError {
    return new MLServiceApiError(
      response.error.code,
      response.error.message,
      statusCode,
      response.error.details,
      response.request_id
    );
  }
}
