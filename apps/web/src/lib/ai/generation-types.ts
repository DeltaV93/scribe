// Type definitions for AI-powered form generation

import type { FieldType, FieldPurpose, FormType } from "@/types";

/**
 * Request schema for form generation
 */
export interface GenerateFormRequest {
  formName: string;
  formType: "INTAKE" | "FOLLOWUP" | "REFERRAL" | "ASSESSMENT" | "CUSTOM";
  description: string;           // Detailed description of outcome/purpose
  dataPoints: string;            // Key data points to collect
  complianceRequirements?: string; // Grant/compliance requirements
}

/**
 * Response schema from form generation
 */
export interface GenerateFormResponse {
  success: boolean;
  fields: GeneratedFieldData[];
  extractionSuggestions: ExtractionSuggestion[];
  reasoning: string;            // AI's explanation of field choices
  error?: string;
}

/**
 * Individual generated field data
 */
export interface GeneratedFieldData {
  id: string;                   // Generated UUID
  name: string;
  slug: string;
  type: FieldType;
  purpose: FieldPurpose;
  purposeNote?: string;
  helpText?: string;
  isRequired: boolean;
  isSensitive: boolean;
  isAiExtractable: boolean;
  options?: GeneratedFieldOption[];  // For dropdown/checkbox
  section?: string;             // Logical grouping
  order: number;
  reasoning: string;            // Why this field was suggested
}

/**
 * Field option for dropdown/checkbox fields
 */
export interface GeneratedFieldOption {
  label: string;
  value: string;
}

/**
 * Extraction suggestion for a field
 */
export interface ExtractionSuggestion {
  fieldSlug: string;
  extractionHint: string;       // Guidance for extraction
  expectedFormat: string;
  exampleValues: string[];
}

/**
 * AI Generation state for form builder
 */
export interface AIGenerationState {
  status: "idle" | "generating" | "reviewing" | "accepted" | "error";
  request: GenerateFormRequest | null;
  generatedFields: GeneratedFieldData[] | null;
  extractionSuggestions: ExtractionSuggestion[] | null;
  reasoning: string | null;
  error: string | null;
}

/**
 * Initial state for AI generation
 */
export const initialAIGenerationState: AIGenerationState = {
  status: "idle",
  request: null,
  generatedFields: null,
  extractionSuggestions: null,
  reasoning: null,
  error: null,
};

/**
 * Raw response from Claude (before parsing)
 */
export interface ClaudeGenerationResponse {
  fields: Array<{
    name: string;
    slug: string;
    type: string;
    purpose: string;
    purposeNote?: string;
    helpText?: string;
    isRequired: boolean;
    isSensitive: boolean;
    isAiExtractable: boolean;
    options?: Array<{ label: string; value: string }>;
    section?: string;
    order: number;
    reasoning: string;
  }>;
  extractionSuggestions: Array<{
    fieldSlug: string;
    extractionHint: string;
    expectedFormat: string;
    exampleValues: string[];
  }>;
  reasoning: string;
}
