/**
 * Mass Notes Service
 *
 * Re-exports from the mass-notes directory for backwards compatibility.
 * The main implementation is in @/lib/services/mass-notes/index.ts
 */

export {
  createMassNoteJob,
  previewMassNotes,
  getMassNotesForSession,
  getSessionAttendeesForMassNote,
  listMassNoteBatches,
  getMassNoteBatch,
  getMassNoteBatchNotes,
  // Types
  type MassNoteInput,
  type MassNotePreviewInput,
  type MassNotePreview,
  type SessionAttendee,
  type SessionAttendeesResult,
  type MassNoteBatchStatus,
  type MassNoteBatchMetadata,
  type MassNoteBatchResult,
  type TemplateVariables,
  type TemplateVariableKey,
  AVAILABLE_VARIABLES,
  // Template processor
  buildVariables,
  resolveTemplateVariables,
  extractVariablesFromTemplate,
  validateTemplateVariables,
  getVariablePreviews,
  type TemplateContext,
} from './mass-notes/index'
