// ============================================
// ENUMS (matching Prisma schema)
// ============================================

export enum Tier {
  FREE = "FREE",
  STARTER = "STARTER",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export enum FormType {
  INTAKE = "INTAKE",
  FOLLOWUP = "FOLLOWUP",
  REFERRAL = "REFERRAL",
  ASSESSMENT = "ASSESSMENT",
  CUSTOM = "CUSTOM",
}

export enum FormStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum FieldType {
  TEXT_SHORT = "TEXT_SHORT",
  TEXT_LONG = "TEXT_LONG",
  NUMBER = "NUMBER",
  DATE = "DATE",
  PHONE = "PHONE",
  EMAIL = "EMAIL",
  ADDRESS = "ADDRESS",
  DROPDOWN = "DROPDOWN",
  CHECKBOX = "CHECKBOX",
  YES_NO = "YES_NO",
  FILE = "FILE",
  SIGNATURE = "SIGNATURE",
}

export enum FieldPurpose {
  GRANT_REQUIREMENT = "GRANT_REQUIREMENT",
  INTERNAL_OPS = "INTERNAL_OPS",
  COMPLIANCE = "COMPLIANCE",
  OUTCOME_MEASUREMENT = "OUTCOME_MEASUREMENT",
  RISK_ASSESSMENT = "RISK_ASSESSMENT",
  OTHER = "OTHER",
}

export enum GranteeType {
  TEAM = "TEAM",
  USER = "USER",
}

export enum FormRole {
  VIEW = "VIEW",
  USE = "USE",
  EDIT = "EDIT",
}

export enum AuditAction {
  SENSITIVE_FIELD_ACCESS = "SENSITIVE_FIELD_ACCESS",
  FORM_CREATED = "FORM_CREATED",
  FORM_UPDATED = "FORM_UPDATED",
  FORM_PUBLISHED = "FORM_PUBLISHED",
  FORM_ARCHIVED = "FORM_ARCHIVED",
  FORM_DELETED = "FORM_DELETED",
  SUBMISSION_CREATED = "SUBMISSION_CREATED",
  SUBMISSION_UPDATED = "SUBMISSION_UPDATED",
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  PERMISSION_CHANGED = "PERMISSION_CHANGED",
  TEMPLATE_CREATED = "TEMPLATE_CREATED",
  FILE_UPLOADED = "FILE_UPLOADED",
  FILE_ACCESSED = "FILE_ACCESSED",
}

export enum ScanStatus {
  PENDING = "PENDING",
  SCANNING = "SCANNING",
  CLEAN = "CLEAN",
  INFECTED = "INFECTED",
  ERROR = "ERROR",
}

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  PROGRAM_MANAGER = "PROGRAM_MANAGER",
  CASE_MANAGER = "CASE_MANAGER",
  FACILITATOR = "FACILITATOR", // PX-729: Class/program facilitators
  VIEWER = "VIEWER",
}

export enum AvailabilityStatus {
  AVAILABLE = "AVAILABLE",
  LIMITED = "LIMITED",
  UNAVAILABLE = "UNAVAILABLE",
  ON_LEAVE = "ON_LEAVE",
}

// ============================================
// FORM BUILDER TYPES
// ============================================

export type WizardStep =
  | "setup"
  | "fields"
  | "organize"
  | "logic"
  | "preview"
  | "ai-config"
  | "publish";

export interface FormSettings {
  allowPartialSaves: boolean;
  requireSupervisorReview: boolean;
  autoArchiveDays: number | null;
  activityTriggers: ("submissions" | "edits" | "views")[];
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface ConditionalLogic {
  id: string;
  targetFieldId: string;
  action: "show" | "hide";
  groups: ConditionGroup[];
  operator: "and" | "or";
}

export interface ConditionGroup {
  id: string;
  conditions: Condition[];
  operator: "and" | "or";
}

export interface Condition {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string | number | boolean | null;
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty"
  | "before"
  | "after";

export interface FieldTranslation {
  name: string;
  helpText?: string;
  options?: FieldOption[];
}

// ============================================
// FORM FIELD TYPE
// ============================================

export interface FormFieldData {
  id: string;
  formId: string;
  slug: string;
  name: string;
  type: FieldType;
  purpose: FieldPurpose;
  purposeNote?: string | null;
  helpText?: string | null;
  isRequired: boolean;
  isSensitive: boolean;
  isAiExtractable: boolean;
  options?: FieldOption[] | null;
  section?: string | null;
  order: number;
  conditionalLogic?: ConditionalLogic | null;
  translations?: Record<string, FieldTranslation> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormData {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  type: FormType;
  status: FormStatus;
  version: number;
  settings: FormSettings;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
  publishedAt?: Date | null;
}

export interface FormWithFields extends FormData {
  fields: FormFieldData[];
}

// ============================================
// AI EXTRACTION TYPES
// ============================================

export interface ExtractionResult {
  extractedData: Record<string, unknown>;
  flaggedForReview: string[];
  tokenUsage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AIConfidenceScore {
  fieldSlug: string;
  confidence: number;
  warning?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// SESSION & AUTH TYPES
// ============================================

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  orgId: string;
  orgName: string;
  permissions: UserPermissions;
  mfaEnabled?: boolean;
}

export interface UserPermissions {
  canCreateForms: boolean;
  canReadForms: boolean;
  canUpdateForms: boolean;
  canDeleteForms: boolean;
  canPublishForms: boolean;
}

// ============================================
// AUDIT TYPES
// ============================================

export interface AuditEntry {
  orgId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorIp: string;
  actorUserAgent: string;
  sessionId: string;
  geolocation?: {
    lat: number;
    lng: number;
    country: string;
    city: string;
  };
  deviceFingerprint?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// FILE UPLOAD TYPES
// ============================================

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  scanStatus: ScanStatus;
}

// ============================================
// SIGNATURE TYPES
// ============================================

export interface SignatureData {
  imageData: string;
  geolocation?: {
    lat: number;
    lng: number;
    accuracy: number;
    country: string;
    city: string;
  };
  deviceFingerprint: string;
  consentRecorded: boolean;
}

// ============================================
// BILLING TYPES
// ============================================

export interface FormPackPurchase {
  packSize: 5 | 10 | 25;
  priceId: string;
}

export interface SubscriptionStatus {
  tier: Tier;
  formsUsed: number;
  formsLimit: number;
  purchasedPacks: number;
}

// ============================================
// FIELD TYPE METADATA
// ============================================

export const FIELD_TYPE_CONFIG: Record<
  FieldType,
  {
    label: string;
    icon: string;
    description: string;
    aiExtractable: boolean;
    aiConfidence: number;
    aiWarning?: string;
  }
> = {
  TEXT_SHORT: {
    label: "Text (Short)",
    icon: "Aa",
    description: "Single line text input",
    aiExtractable: true,
    aiConfidence: 80,
  },
  TEXT_LONG: {
    label: "Text (Long)",
    icon: "¶",
    description: "Paragraph/multi-line input",
    aiExtractable: true,
    aiConfidence: 75,
  },
  NUMBER: {
    label: "Number",
    icon: "#",
    description: "Numeric values only",
    aiExtractable: true,
    aiConfidence: 85,
  },
  DATE: {
    label: "Date",
    icon: "📅",
    description: "Date picker",
    aiExtractable: true,
    aiConfidence: 90,
  },
  PHONE: {
    label: "Phone Number",
    icon: "📞",
    description: "Formatted phone input",
    aiExtractable: true,
    aiConfidence: 85,
  },
  EMAIL: {
    label: "Email",
    icon: "@",
    description: "Email with validation",
    aiExtractable: true,
    aiConfidence: 85,
  },
  ADDRESS: {
    label: "Address",
    icon: "📍",
    description: "Radar autocomplete (US only)",
    aiExtractable: true,
    aiConfidence: 70,
    aiWarning: "Complex addresses may require manual review",
  },
  DROPDOWN: {
    label: "Dropdown",
    icon: "▼",
    description: "Single select from options",
    aiExtractable: true,
    aiConfidence: 75,
  },
  CHECKBOX: {
    label: "Checkbox",
    icon: "☑",
    description: "Multi-select from options",
    aiExtractable: true,
    aiConfidence: 70,
  },
  YES_NO: {
    label: "Yes/No",
    icon: "⊘",
    description: "Boolean toggle",
    aiExtractable: true,
    aiConfidence: 80,
  },
  FILE: {
    label: "File Upload",
    icon: "📎",
    description: "Document/image attachment",
    aiExtractable: true,
    aiConfidence: 20,
    aiWarning: "Only PDF text content can be extracted",
  },
  SIGNATURE: {
    label: "Signature",
    icon: "✍",
    description: "Digital signature capture",
    aiExtractable: false,
    aiConfidence: 0,
    aiWarning: "Signatures cannot be extracted from audio",
  },
};

export const PURPOSE_CONFIG: Record<
  FieldPurpose,
  {
    label: string;
    description: string;
  }
> = {
  GRANT_REQUIREMENT: {
    label: "Grant/Funder Requirement",
    description: "Required for funding compliance",
  },
  INTERNAL_OPS: {
    label: "Internal Operations",
    description: "Needed for day-to-day case management",
  },
  COMPLIANCE: {
    label: "Compliance/Legal",
    description: "Required by law or regulation",
  },
  OUTCOME_MEASUREMENT: {
    label: "Outcome Measurement",
    description: "Tracks program effectiveness",
  },
  RISK_ASSESSMENT: {
    label: "Risk Assessment",
    description: "Identifies client risk factors",
  },
  OTHER: {
    label: "Other",
    description: "Custom reason",
  },
};
