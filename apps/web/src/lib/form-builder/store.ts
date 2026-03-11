import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  FormType,
  FormStatus,
  FieldType,
  FieldPurpose,
  type WizardStep,
  type FormSettings,
  type FormFieldData,
  type FormData,
} from "@/types";
import type {
  AIGenerationState,
  GenerateFormRequest,
  GeneratedFieldData,
  ExtractionSuggestion,
} from "@/lib/ai/generation-types";
import { initialAIGenerationState } from "@/lib/ai/generation-types";

// ============================================
// CREATION METHOD
// ============================================

export type CreationMethod = "ai" | "upload" | "manual";

// Persisted creation method preference
export const lastCreationMethodAtom = atomWithStorage<CreationMethod | null>(
  "scrybe_form_creation_method",
  null
);

// Current session creation method
export const creationMethodAtom = atom<CreationMethod | null>(null);

// ============================================
// FEATURE FLAGS (passed from server)
// ============================================

export interface FormBuilderFeatureFlags {
  photoToForm: boolean;
  formLogic: boolean;
}

export const featureFlagsAtom = atom<FormBuilderFeatureFlags>({
  photoToForm: false,
  formLogic: false,
});

// ============================================
// FIELD SOURCE TRACKING
// ============================================

export type FieldSource = "ai" | "upload" | "manual";

// Track source of each field by field ID
export const fieldSourcesAtom = atom<Record<string, FieldSource>>({});

// ============================================
// FORM STATE
// ============================================

export interface FormBuilderState {
  form: Partial<FormData>;
  fields: FormFieldData[];
  selectedFieldId: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
}

const defaultFormSettings: FormSettings = {
  allowPartialSaves: true,
  requireSupervisorReview: false,
  autoArchiveDays: null,
  activityTriggers: ["submissions"],
};

const initialFormState: FormBuilderState = {
  form: {
    name: "",
    description: "",
    type: FormType.INTAKE,
    status: FormStatus.DRAFT,
    version: 1,
    settings: defaultFormSettings,
  },
  fields: [],
  selectedFieldId: null,
  isDirty: false,
  lastSavedAt: null,
};

// Main form builder state atom
export const formBuilderAtom = atom<FormBuilderState>(initialFormState);

// Current wizard step
export const wizardStepAtom = atom<WizardStep>("setup");

// Auto-save draft to localStorage
export const draftFormAtom = atomWithStorage<FormBuilderState | null>(
  "scrybe_form_draft",
  null
);

// ============================================
// DERIVED ATOMS
// ============================================

// Get the current form
export const currentFormAtom = atom((get) => get(formBuilderAtom).form);

// Get all fields
export const fieldsAtom = atom((get) => get(formBuilderAtom).fields);

// Get fields sorted by order
export const sortedFieldsAtom = atom((get) => {
  const fields = get(formBuilderAtom).fields;
  return [...fields].sort((a, b) => a.order - b.order);
});

// Get fields grouped by section
export const fieldsBySectionAtom = atom((get) => {
  const fields = get(sortedFieldsAtom);
  const sections: Record<string, FormFieldData[]> = {};

  fields.forEach((field) => {
    const section = field.section || "default";
    if (!sections[section]) {
      sections[section] = [];
    }
    sections[section].push(field);
  });

  return sections;
});

// Get selected field
export const selectedFieldAtom = atom((get) => {
  const state = get(formBuilderAtom);
  return state.fields.find((f) => f.id === state.selectedFieldId) || null;
});

// Check if form is valid for publishing
export const canPublishAtom = atom((get) => {
  const state = get(formBuilderAtom);
  const form = state.form;

  // Must have a name
  if (!form.name?.trim()) return false;

  // Must have at least one field
  if (state.fields.length === 0) return false;

  // All required fields must have a name
  const invalidFields = state.fields.filter((f) => !f.name?.trim());
  if (invalidFields.length > 0) return false;

  return true;
});

// Get AI-extractable fields
export const aiExtractableFieldsAtom = atom((get) => {
  const fields = get(sortedFieldsAtom);
  return fields.filter((f) => f.isAiExtractable);
});

// Get sensitive fields count
export const sensitiveFieldsCountAtom = atom((get) => {
  const fields = get(formBuilderAtom).fields;
  return fields.filter((f) => f.isSensitive).length;
});

// Get visible wizard steps based on creation method and feature flags
export const visibleStepsAtom = atom((get) => {
  const method = get(creationMethodAtom);
  const flags = get(featureFlagsAtom);

  // Define all possible steps with their visibility rules
  const allSteps: Array<{
    id: WizardStep;
    showForMethods: CreationMethod[];
    requiresFlag?: keyof FormBuilderFeatureFlags;
  }> = [
    { id: "setup", showForMethods: ["ai"] }, // AI Setup - only for AI method
    { id: "fields", showForMethods: ["ai", "upload", "manual"] },
    { id: "organize", showForMethods: ["ai", "upload", "manual"] },
    { id: "logic", showForMethods: ["ai", "upload", "manual"], requiresFlag: "formLogic" },
    { id: "preview", showForMethods: ["ai", "upload", "manual"] },
    { id: "ai-config", showForMethods: ["ai", "upload", "manual"] },
    { id: "publish", showForMethods: ["ai", "upload", "manual"] },
  ];

  // Filter steps based on method and flags
  return allSteps
    .filter((step) => {
      // If no method selected yet, show all steps for AI (default)
      const effectiveMethod = method || "ai";

      // Check if step should show for current method
      if (!step.showForMethods.includes(effectiveMethod)) {
        return false;
      }

      // Check if step requires a feature flag
      if (step.requiresFlag && !flags[step.requiresFlag]) {
        return false;
      }

      return true;
    })
    .map((step) => step.id);
});

// Get field source for a specific field
export const getFieldSourceAtom = atom((get) => (fieldId: string): FieldSource | null => {
  const sources = get(fieldSourcesAtom);
  return sources[fieldId] || null;
});

// ============================================
// ACTION ATOMS
// ============================================

// Update form metadata
export const updateFormAtom = atom(
  null,
  (get, set, updates: Partial<FormData>) => {
    const current = get(formBuilderAtom);
    set(formBuilderAtom, {
      ...current,
      form: { ...current.form, ...updates },
      isDirty: true,
    });
  }
);

// Add a new field
export const addFieldAtom = atom(
  null,
  (
    get,
    set,
    fieldData: Partial<FormFieldData> & { type: FieldType },
    source?: FieldSource
  ) => {
    const current = get(formBuilderAtom);
    const newField: FormFieldData = {
      id: crypto.randomUUID(),
      formId: current.form.id || "",
      slug: generateSlug(fieldData.name || fieldData.type),
      name: fieldData.name || getDefaultFieldName(fieldData.type),
      type: fieldData.type,
      purpose: fieldData.purpose || FieldPurpose.INTERNAL_OPS,
      purposeNote: fieldData.purposeNote || null,
      helpText: fieldData.helpText || null,
      isRequired: fieldData.isRequired ?? false,
      isSensitive: fieldData.isSensitive ?? false,
      isAiExtractable: fieldData.isAiExtractable ?? true,
      options: fieldData.options || null,
      section: fieldData.section || null,
      order: current.fields.length,
      conditionalLogic: null,
      translations: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set(formBuilderAtom, {
      ...current,
      fields: [...current.fields, newField],
      selectedFieldId: newField.id,
      isDirty: true,
    });

    // Track field source if provided
    if (source) {
      const currentSources = get(fieldSourcesAtom);
      set(fieldSourcesAtom, {
        ...currentSources,
        [newField.id]: source,
      });
    }

    return newField;
  }
);

// Update an existing field
export const updateFieldAtom = atom(
  null,
  (get, set, fieldId: string, updates: Partial<FormFieldData>) => {
    const current = get(formBuilderAtom);
    const fieldIndex = current.fields.findIndex((f) => f.id === fieldId);

    if (fieldIndex === -1) return;

    const updatedFields = [...current.fields];
    updatedFields[fieldIndex] = {
      ...updatedFields[fieldIndex],
      ...updates,
      updatedAt: new Date(),
    };

    // Regenerate slug if name changed
    if (updates.name) {
      updatedFields[fieldIndex].slug = generateSlug(updates.name);
    }

    set(formBuilderAtom, {
      ...current,
      fields: updatedFields,
      isDirty: true,
    });
  }
);

// Remove a field
export const removeFieldAtom = atom(null, (get, set, fieldId: string) => {
  const current = get(formBuilderAtom);
  const updatedFields = current.fields
    .filter((f) => f.id !== fieldId)
    .map((f, index) => ({ ...f, order: index }));

  set(formBuilderAtom, {
    ...current,
    fields: updatedFields,
    selectedFieldId:
      current.selectedFieldId === fieldId ? null : current.selectedFieldId,
    isDirty: true,
  });

  // Clean up field source tracking
  const currentSources = get(fieldSourcesAtom);
  if (currentSources[fieldId]) {
    const { [fieldId]: _, ...remainingSources } = currentSources;
    set(fieldSourcesAtom, remainingSources);
  }
});

// Reorder fields (for drag and drop)
export const reorderFieldsAtom = atom(
  null,
  (get, set, sourceIndex: number, destinationIndex: number) => {
    const current = get(formBuilderAtom);
    const sortedFields = [...current.fields].sort((a, b) => a.order - b.order);

    const [removed] = sortedFields.splice(sourceIndex, 1);
    sortedFields.splice(destinationIndex, 0, removed);

    const reorderedFields = sortedFields.map((field, index) => ({
      ...field,
      order: index,
    }));

    set(formBuilderAtom, {
      ...current,
      fields: reorderedFields,
      isDirty: true,
    });
  }
);

// Select a field
export const selectFieldAtom = atom(
  null,
  (get, set, fieldId: string | null) => {
    const current = get(formBuilderAtom);
    set(formBuilderAtom, {
      ...current,
      selectedFieldId: fieldId,
    });
  }
);

// Duplicate a field
export const duplicateFieldAtom = atom(null, (get, set, fieldId: string) => {
  const current = get(formBuilderAtom);
  const fieldToDuplicate = current.fields.find((f) => f.id === fieldId);

  if (!fieldToDuplicate) return;

  const duplicatedField: FormFieldData = {
    ...fieldToDuplicate,
    id: crypto.randomUUID(),
    name: `${fieldToDuplicate.name} (Copy)`,
    slug: generateSlug(`${fieldToDuplicate.name} copy`),
    order: current.fields.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  set(formBuilderAtom, {
    ...current,
    fields: [...current.fields, duplicatedField],
    selectedFieldId: duplicatedField.id,
    isDirty: true,
  });
});

// Reset form builder state
export const resetFormBuilderAtom = atom(null, (_get, set) => {
  set(formBuilderAtom, initialFormState);
  set(wizardStepAtom, "setup");
  set(creationMethodAtom, null);
  set(fieldSourcesAtom, {});
});

// Set field sources for multiple fields at once
export const setFieldSourcesAtom = atom(
  null,
  (get, set, sources: Record<string, FieldSource>) => {
    const current = get(fieldSourcesAtom);
    set(fieldSourcesAtom, { ...current, ...sources });
  }
);

// Set creation method and save to localStorage
export const setCreationMethodAtom = atom(
  null,
  (_get, set, method: CreationMethod) => {
    set(creationMethodAtom, method);
    set(lastCreationMethodAtom, method);
  }
);

// Load form into builder (for editing)
export const loadFormAtom = atom(
  null,
  (_get, set, form: FormData, fields: FormFieldData[]) => {
    set(formBuilderAtom, {
      form,
      fields,
      selectedFieldId: null,
      isDirty: false,
      lastSavedAt: new Date(),
    });
    set(wizardStepAtom, "fields");
  }
);

// Mark as saved
export const markAsSavedAtom = atom(null, (get, set) => {
  const current = get(formBuilderAtom);
  set(formBuilderAtom, {
    ...current,
    isDirty: false,
    lastSavedAt: new Date(),
  });
});

// ============================================
// AI GENERATION STATE
// ============================================

// AI Generation state atom
export const aiGenerationAtom = atom<AIGenerationState>(initialAIGenerationState);

// Get AI generation status
export const aiGenerationStatusAtom = atom((get) => get(aiGenerationAtom).status);

// Get generated fields
export const generatedFieldsAtom = atom((get) => get(aiGenerationAtom).generatedFields);

// Get extraction suggestions
export const extractionSuggestionsAtom = atom(
  (get) => get(aiGenerationAtom).extractionSuggestions
);

// Get AI reasoning
export const aiReasoningAtom = atom((get) => get(aiGenerationAtom).reasoning);

// Get AI error
export const aiErrorAtom = atom((get) => get(aiGenerationAtom).error);

// Trigger generation from footer button (increments to signal AISetupStep)
export const triggerGenerationAtom = atom(0);

// ============================================
// AI GENERATION ACTIONS
// ============================================

// Start form generation
export const startGenerationAtom = atom(
  null,
  async (get, set, request: GenerateFormRequest) => {
    // Set generating status
    set(aiGenerationAtom, {
      ...get(aiGenerationAtom),
      status: "generating",
      request,
      error: null,
    });

    try {
      const response = await fetch("/api/ai/generate-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate form");
      }

      // Set reviewing status with generated data
      set(aiGenerationAtom, {
        status: "reviewing",
        request,
        generatedFields: data.fields,
        extractionSuggestions: data.extractionSuggestions,
        reasoning: data.reasoning,
        error: null,
      });

      return data;
    } catch (error) {
      set(aiGenerationAtom, {
        ...get(aiGenerationAtom),
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
);

// Accept generated fields and add to form builder
export const acceptGeneratedFieldsAtom = atom(
  null,
  (get, set, selectedFieldIds?: string[]) => {
    const aiState = get(aiGenerationAtom);
    const current = get(formBuilderAtom);

    if (!aiState.generatedFields) return;

    // Filter to selected fields if provided, otherwise use all
    const fieldsToAdd = selectedFieldIds
      ? aiState.generatedFields.filter((f) => selectedFieldIds.includes(f.id))
      : aiState.generatedFields;

    // Convert generated fields to FormFieldData
    const newFields: FormFieldData[] = fieldsToAdd.map((gf, index) => ({
      id: gf.id,
      formId: current.form.id || "",
      slug: gf.slug,
      name: gf.name,
      type: gf.type,
      purpose: gf.purpose,
      purposeNote: gf.purposeNote || null,
      helpText: gf.helpText || null,
      isRequired: gf.isRequired,
      isSensitive: gf.isSensitive,
      isAiExtractable: gf.isAiExtractable,
      options: gf.options || null,
      section: gf.section || null,
      order: current.fields.length + index,
      conditionalLogic: null,
      translations: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Update form builder state
    set(formBuilderAtom, {
      ...current,
      fields: [...current.fields, ...newFields],
      isDirty: true,
    });

    // Track field sources as "ai" for all generated fields
    const currentSources = get(fieldSourcesAtom);
    const newSources = newFields.reduce(
      (acc, field) => ({ ...acc, [field.id]: "ai" as FieldSource }),
      {} as Record<string, FieldSource>
    );
    set(fieldSourcesAtom, { ...currentSources, ...newSources });

    // Update AI generation state to accepted
    set(aiGenerationAtom, {
      ...aiState,
      status: "accepted",
    });

    // Move to fields step
    set(wizardStepAtom, "fields");
  }
);

// Reset AI generation state
export const resetGenerationAtom = atom(null, (_get, set) => {
  set(aiGenerationAtom, initialAIGenerationState);
});

// Toggle field selection in review (for the UI to track which fields are selected)
export const toggleGeneratedFieldAtom = atom(
  null,
  (get, set, fieldId: string) => {
    const aiState = get(aiGenerationAtom);
    if (!aiState.generatedFields) return;

    // This atom is for UI state - the actual selection is managed in the component
    // We just need to ensure the field exists
    const exists = aiState.generatedFields.some((f) => f.id === fieldId);
    if (!exists) {
      console.warn(`Field ${fieldId} not found in generated fields`);
    }
  }
);

// Get extraction suggestion for a specific field
export const getExtractionSuggestionAtom = atom((get) => (fieldSlug: string) => {
  const suggestions = get(aiGenerationAtom).extractionSuggestions;
  return suggestions?.find((s) => s.fieldSlug === fieldSlug) || null;
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

function getDefaultFieldName(type: FieldType): string {
  const names: Record<FieldType, string> = {
    TEXT_SHORT: "Text Field",
    TEXT_LONG: "Long Text",
    NUMBER: "Number",
    DATE: "Date",
    PHONE: "Phone Number",
    EMAIL: "Email Address",
    ADDRESS: "Address",
    DROPDOWN: "Dropdown",
    CHECKBOX: "Checkboxes",
    YES_NO: "Yes/No",
    FILE: "File Upload",
    SIGNATURE: "Signature",
  };
  return names[type] || "New Field";
}
