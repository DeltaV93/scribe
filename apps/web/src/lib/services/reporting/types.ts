/**
 * Reporting Types
 *
 * TypeScript interfaces for the automated reporting system.
 */

import { ReportType, ReportStatus, ReportTemplateStatus } from "@prisma/client";

// ============================================
// REPORT TEMPLATE TYPES
// ============================================

export interface ReportTemplateSection {
  type: string;
  title: string;
  order: number;
  enabled: boolean;
  customContent?: string;
}

export interface ReportTemplateMetric {
  id: string;
  name: string;
  calculation: unknown;
  displayFormat: string;
  enabled: boolean;
  customLabel?: string;
}

export interface ReportTemplateConfig {
  metrics: ReportTemplateMetric[];
  sections: ReportTemplateSection[];
  questionnaireAnswers: Record<string, unknown>;
  funderRequirements?: Record<string, unknown>;
}

// ============================================
// REPORT SCHEDULE TYPES
// ============================================

export interface ReportSchedule {
  id: string;
  templateId: string;
  orgId: string;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  failureCount: number;
  distributionSettings: DistributionSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionSettings {
  enabled: boolean;
  recipients: EmailRecipient[];
  subject?: string;
  message?: string;
  attachPdf: boolean;
  attachExcel?: boolean;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  type: "to" | "cc" | "bcc";
}

// ============================================
// REPORT OUTPUT TYPES
// ============================================

export type ReportOutputFormat = "pdf" | "excel" | "csv";

export interface ReportGenerationResult {
  reportId: string;
  status: ReportStatus;
  pdfPath?: string;
  excelPath?: string;
  generatedAt: Date;
  metrics: ReportMetricResult[];
  narratives: ReportNarrativeSection[];
}

export interface ReportMetricResult {
  metricId: string;
  name: string;
  value: number;
  formattedValue: string;
  category: string;
  benchmarkStatus?: "below" | "good" | "excellent";
  previousValue?: number;
  changePercentage?: number;
}

export interface ReportNarrativeSection {
  type: string;
  title: string;
  content: string;
  wordCount: number;
}

// ============================================
// FUNDER-SPECIFIC TEMPLATE TYPES
// ============================================

export interface FunderTemplateDefinition {
  id: string;
  name: string;
  funderName: string;
  reportType: ReportType;
  description: string;
  version: string;
  requiredMetrics: string[];
  requiredSections: string[];
  outputFormat: ReportOutputFormat[];
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  rule: "required" | "min" | "max" | "pattern" | "custom";
  value?: unknown;
  message: string;
}

// ============================================
// REPORT LISTING & FILTERING
// ============================================

export interface ReportListOptions {
  status?: ReportStatus;
  templateId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ReportListResult {
  reports: ReportSummary[];
  total: number;
  hasMore: boolean;
}

export interface ReportSummary {
  id: string;
  templateName: string;
  templateType: ReportType;
  status: ReportStatus;
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  generatedAt?: Date;
  generatedBy: {
    name: string | null;
    email: string;
  };
  pdfUrl?: string;
}

// ============================================
// SCHEDULE LISTING & STATUS
// ============================================

export interface ScheduleListResult {
  schedules: ScheduleSummary[];
  total: number;
}

export interface ScheduleSummary {
  id: string;
  templateId: string;
  templateName: string;
  templateType: ReportType;
  enabled: boolean;
  cronExpression: string;
  cronDescription: string;
  timezone: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  failureCount: number;
  distributionEnabled: boolean;
  recipientCount: number;
}
