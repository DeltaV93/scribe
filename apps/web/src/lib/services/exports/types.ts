/**
 * Export Service Types
 *
 * TypeScript interfaces for funder-specific data exports.
 */

import { ExportType, ExportStatus, ExportTemplateStatus } from "@prisma/client";

// ============================================
// FIELD MAPPING TYPES
// ============================================

/**
 * Mapping between Scrybe fields and external funder fields
 */
export interface FieldMapping {
  /** External field name as required by funder */
  externalField: string;
  /** Scrybe field path (e.g., "client.firstName", "form:dateOfBirth") */
  scrybeField: string;
  /** Whether this field is required by the funder */
  required: boolean;
  /** Transformer to apply (e.g., "date:YYYY-MM-DD", "code:HMIS_VETERAN") */
  transformer?: string;
  /** Default value if field is missing */
  defaultValue?: string;
  /** Help text explaining the field */
  description?: string;
}

/**
 * Code mapping for converting Scrybe values to funder codes
 */
export interface CodeMapping {
  [scrybeValue: string]: string;
}

/**
 * Available code mappings by name
 */
export interface CodeMappings {
  [codeName: string]: CodeMapping;
}

// ============================================
// TEMPLATE TYPES
// ============================================

/**
 * Pre-defined template definition for a funder type
 */
export interface PredefinedTemplateDefinition {
  name: string;
  description: string;
  outputFormat: "CSV" | "TXT" | "XLSX" | "XML";
  delimiter?: string;
  encoding?: string;
  includeHeaders?: boolean;
  fields: FieldMapping[];
  codeMappings: CodeMappings;
  validationRules?: ValidationRule[];
}

/**
 * Output configuration for exports
 */
export interface OutputConfig {
  delimiter: string;
  encoding: string;
  includeHeaders: boolean;
  lineEnding: "LF" | "CRLF";
  quoteChar?: string;
  escapeChar?: string;
  dateFormat?: string;
}

// ============================================
// VALIDATION TYPES
// ============================================

/**
 * Validation rule definition
 */
export interface ValidationRule {
  field: string;
  type: "required" | "format" | "range" | "enum" | "dependency" | "custom";
  message: string;
  params?: Record<string, unknown>;
}

/**
 * Validation error for an export record
 */
export interface ValidationError {
  recordIndex: number;
  clientId?: string;
  field: string;
  value: unknown;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validation result for an entire export
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  validRecordCount: number;
  invalidRecordCount: number;
}

// ============================================
// DATA EXTRACTION TYPES
// ============================================

/**
 * Source for extracting data
 */
export type DataSource = "client" | "form" | "program" | "enrollment" | "attendance";

/**
 * Extracted record from Scrybe data
 */
export interface ExtractedRecord {
  clientId: string;
  clientName: string;
  data: Record<string, unknown>;
  formSubmissionIds: string[];
  extractedAt: Date;
}

/**
 * Parameters for data extraction
 */
export interface ExtractionParams {
  orgId: string;
  sourceFormIds: string[];
  fieldMappings: FieldMapping[];
  codeMappings: CodeMappings;
  periodStart: Date;
  periodEnd: Date;
  programIds?: string[];
  clientIds?: string[];
}

/**
 * Result of data extraction
 */
export interface ExtractionResult {
  records: ExtractedRecord[];
  totalClients: number;
  extractedFields: string[];
  missingFields: Array<{ field: string; count: number }>;
}

// ============================================
// EXPORT GENERATION TYPES
// ============================================

/**
 * Parameters for generating an export
 */
export interface GenerateExportParams {
  templateId: string;
  orgId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  programIds?: string[];
  clientIds?: string[];
  skipValidation?: boolean;
}

/**
 * Result of export generation
 */
export interface GenerateExportResult {
  exportId: string;
  status: ExportStatus;
  recordCount: number;
  filePath?: string;
  validationResult?: ValidationResult;
}

/**
 * Preview of export (first N rows)
 */
export interface ExportPreview {
  headers: string[];
  rows: string[][];
  totalRecords: number;
  validationWarnings: ValidationError[];
}

// ============================================
// GENERATOR INTERFACE
// ============================================

/**
 * Interface for export generators
 */
export interface ExportGenerator {
  /** Export type this generator handles */
  exportType: ExportType;

  /** Generate export file from records */
  generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer>;

  /** Validate records against funder requirements */
  validate(records: ExtractedRecord[]): ValidationResult;

  /** Get file extension for this export type */
  getFileExtension(): string;

  /** Get content type for this export type */
  getContentType(): string;
}

// ============================================
// STORAGE TYPES
// ============================================

/**
 * S3 key structure for exports
 */
export interface ExportStorageKey {
  orgId: string;
  exportId: string;
  filename: string;
}

/**
 * Export file metadata
 */
export interface ExportFileMetadata {
  exportId: string;
  orgId: string;
  templateId: string;
  exportType: ExportType;
  recordCount: number;
  generatedAt: string;
  generatedById: string;
  periodStart: string;
  periodEnd: string;
}

// ============================================
// JOB DATA TYPE
// ============================================

/**
 * Job data for async export processing
 */
export interface FunderExportJobData {
  jobProgressId: string;
  exportId: string;
  templateId: string;
  orgId: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  programIds?: string[];
  clientIds?: string[];
}
