/**
 * Import Service Types
 *
 * TypeScript interfaces for the import system.
 */

import { DuplicateAction, ImportStatus, ImportRecordStatus } from "@prisma/client";

// ============================================
// FIELD MAPPING TYPES
// ============================================

export interface ImportFieldMapping {
  sourceColumn: string;           // Column name from import file
  targetField: string;            // Scrybe field path (e.g., "client.firstName", "form:ssn")
  transformer?: string;           // Optional transformation (e.g., "date:MM/DD/YYYY", "phone:strip")
  required?: boolean;
  defaultValue?: string | number | boolean;
  confidence?: number;            // AI confidence score (0-1)
  aiSuggested?: boolean;          // Whether this was AI-suggested
}

export interface FieldMappingSuggestion {
  sourceColumn: string;
  suggestions: Array<{
    targetField: string;
    confidence: number;
    reason: string;
  }>;
  sampleValues: string[];
}

// ============================================
// DUPLICATE DETECTION TYPES
// ============================================

export interface DuplicateSettings {
  enabled: boolean;
  matchFields: DuplicateMatchField[];
  threshold: number;              // 0-1, similarity threshold
  defaultAction: DuplicateAction;
}

export interface DuplicateMatchField {
  field: string;                  // Field to match on
  weight: number;                 // Weight for this field (0-1)
  matchType: "exact" | "fuzzy" | "phonetic" | "normalized";
  caseSensitive?: boolean;
}

export interface DuplicateMatch {
  clientId: string;
  clientName: string;
  matchScore: number;             // 0-1
  matchedFields: Array<{
    field: string;
    importValue: string;
    existingValue: string;
    score: number;
  }>;
}

export interface DuplicateCheckResult {
  rowNumber: number;
  sourceData: Record<string, unknown>;
  matches: DuplicateMatch[];
  suggestedAction: DuplicateAction;
  requiresReview: boolean;
}

// ============================================
// FILE PARSING TYPES
// ============================================

export interface ParsedFile {
  fileName: string;
  fileFormat: "CSV" | "XLSX" | "JSON";
  totalRows: number;
  columns: string[];
  preview: Record<string, unknown>[];  // First N rows
  errors: ParseError[];
}

export interface ParseError {
  row?: number;
  column?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParseOptions {
  delimiter?: string;             // For CSV
  sheetName?: string;             // For Excel
  hasHeaders?: boolean;
  encoding?: string;
  skipRows?: number;
  maxRows?: number;
}

// ============================================
// IMPORT EXECUTION TYPES
// ============================================

export interface ImportPreview {
  totalRows: number;
  columns: string[];
  preview: Array<{
    rowNumber: number;
    sourceData: Record<string, unknown>;
    mappedData: Record<string, unknown>;
    duplicates: DuplicateMatch[];
    validationErrors: string[];
    suggestedAction: DuplicateAction;
  }>;
  summary: {
    newRecords: number;
    potentialUpdates: number;
    potentialDuplicates: number;
    validationErrors: number;
  };
}

export interface ImportExecutionParams {
  batchId: string;
  fieldMappings: ImportFieldMapping[];
  duplicateSettings: DuplicateSettings;
  duplicateResolutions?: Record<number, {
    action: DuplicateAction;
    selectedMatchId?: string;
  }>;
}

export interface ImportExecutionResult {
  batchId: string;
  status: ImportStatus;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
  rollbackAvailableUntil: Date;
}

// ============================================
// ROLLBACK TYPES
// ============================================

export interface RollbackResult {
  success: boolean;
  batchId: string;
  rolledBackCount: number;
  failedCount: number;
  errors: string[];
}

// Note: ImportJobData is defined in @/lib/jobs/queue.ts

// ============================================
// AI MAPPING TYPES
// ============================================

export interface AIMappingRequest {
  columns: string[];
  sampleData: Record<string, unknown>[];
  targetFields: TargetFieldDefinition[];
  sourceSystem?: string;
}

export interface TargetFieldDefinition {
  path: string;
  label: string;
  type: string;
  required?: boolean;
  examples?: string[];
}

export interface AIMappingResponse {
  mappings: ImportFieldMapping[];
  unmappedColumns: string[];
  confidence: number;
  notes: string[];
}

// ============================================
// SCRYBE TARGET FIELDS
// ============================================

export const SCRYBE_CLIENT_FIELDS: TargetFieldDefinition[] = [
  { path: "client.firstName", label: "First Name", type: "string", required: true },
  { path: "client.lastName", label: "Last Name", type: "string", required: true },
  { path: "client.phone", label: "Phone Number", type: "phone", required: true },
  { path: "client.email", label: "Email Address", type: "email" },
  { path: "client.address.street", label: "Street Address", type: "string" },
  { path: "client.address.city", label: "City", type: "string" },
  { path: "client.address.state", label: "State", type: "string" },
  { path: "client.address.zip", label: "ZIP Code", type: "string" },
  { path: "client.internalId", label: "External/Internal ID", type: "string" },
];

export const DEFAULT_DUPLICATE_SETTINGS: DuplicateSettings = {
  enabled: true,
  matchFields: [
    { field: "client.firstName", weight: 0.3, matchType: "fuzzy" },
    { field: "client.lastName", weight: 0.3, matchType: "fuzzy" },
    { field: "client.phone", weight: 0.25, matchType: "normalized" },
    { field: "client.email", weight: 0.15, matchType: "exact" },
  ],
  threshold: 0.8,
  defaultAction: "SKIP",
};
