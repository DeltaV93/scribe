// AI Extraction Module
export { anthropic, EXTRACTION_MODEL, FAST_MODEL } from "./client";
export {
  extractFormData,
  validateExtraction,
  normalizeExtractionValue,
  calculateOverallConfidence,
} from "./extraction";
export {
  generateSystemPrompt,
  generateExtractionPrompt,
  generateFieldDescriptions,
  generateDocumentExtractionPrompt,
} from "./prompts";
export {
  getExamplesForFields,
  addExtractionExample,
  updateExtractionExample,
  deleteExtractionExample,
  getFieldExamples,
  countExamplesForForm,
  learnFromExtraction,
  importExamples,
} from "./examples";
export type {
  ExtractableField,
  FieldExtractionResult,
  ExtractionResult,
  ExtractionExample,
  PromptOptions,
  ExtractionProgressCallback,
} from "./types";

// AI Form Generation Module
export {
  generateFormFields,
  parseGeneratedForm,
  groupFieldsBySection,
  getFieldSummary,
} from "./generation";
export {
  FORM_GENERATION_SYSTEM_PROMPT,
  buildGenerationPrompt,
  EXAMPLE_REQUESTS,
} from "./generation-prompts";
export type {
  GenerateFormRequest,
  GenerateFormResponse,
  GeneratedFieldData,
  GeneratedFieldOption,
  ExtractionSuggestion,
  AIGenerationState,
  ClaudeGenerationResponse,
} from "./generation-types";
export { initialAIGenerationState } from "./generation-types";
