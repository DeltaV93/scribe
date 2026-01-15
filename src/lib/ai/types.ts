// Field definition for extraction
// Using string types to avoid Prisma enum type conflicts
export interface ExtractableField {
  id: string;
  slug: string;
  name: string;
  type: string;
  purpose: string;
  helpText?: string | null;
  isRequired: boolean;
  options?: { value: string; label: string }[] | null;
}

// Extraction result for a single field
export interface FieldExtractionResult {
  fieldId: string;
  slug: string;
  value: string | number | boolean | string[] | null;
  confidence: number; // 0-100
  reasoning?: string;
  sourceSnippet?: string;
  needsReview: boolean;
}

// Full extraction result
export interface ExtractionResult {
  success: boolean;
  fields: FieldExtractionResult[];
  overallConfidence: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  processingTimeMs: number;
  error?: string;
}

// RAG example for few-shot learning
export interface ExtractionExample {
  id: string;
  fieldId: string;
  transcriptSnippet: string;
  extractedValue: string;
}

// Prompt generation options
export interface PromptOptions {
  includeExamples?: boolean;
  maxExamplesPerField?: number;
  strictMode?: boolean; // Require exact matches for dropdowns
}

// Streaming extraction callback
export type ExtractionProgressCallback = (progress: {
  currentField: string;
  fieldsCompleted: number;
  totalFields: number;
  partialResults?: FieldExtractionResult[];
}) => void;
