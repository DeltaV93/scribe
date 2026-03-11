"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  createForm,
  updateForm,
  getFormById,
  archiveForm,
  deleteForm,
  duplicateForm,
  publishForm,
  syncFormFields,
} from "@/lib/services/forms";
import {
  FormType,
  type FormSettings,
  type FormFieldData,
} from "@/types";

// ============================================
// TYPES
// ============================================

export interface SaveFormState {
  success?: boolean;
  error?: string;
  formId?: string;
}

export interface PublishFormState {
  success?: boolean;
  error?: string;
  version?: number;
}

// ============================================
// FORM ACTIONS
// ============================================

/**
 * Create a new form
 */
export async function createFormAction(
  name: string,
  type: FormType,
  description?: string | null,
  settings?: FormSettings
): Promise<SaveFormState> {
  try {
    const user = await requireAuth();

    if (!user.permissions.canCreateForms) {
      return { error: "You do not have permission to create forms" };
    }

    const form = await createForm({
      orgId: user.orgId,
      createdById: user.id,
      name,
      type,
      description,
      settings,
    });

    revalidatePath("/forms");
    return { success: true, formId: form.id };
  } catch (error) {
    console.error("Error creating form:", error);
    return { error: "Failed to create form" };
  }
}

/**
 * Save form (create or update with fields)
 */
export async function saveFormAction(
  formId: string | null,
  data: {
    name: string;
    description?: string | null;
    type: FormType;
    settings?: FormSettings;
    fields: FormFieldData[];
  }
): Promise<SaveFormState> {
  try {
    const user = await requireAuth();

    // Creating new form
    if (!formId) {
      if (!user.permissions.canCreateForms) {
        return { error: "You do not have permission to create forms" };
      }

      const form = await createForm({
        orgId: user.orgId,
        createdById: user.id,
        name: data.name,
        type: data.type,
        description: data.description,
        settings: data.settings,
      });

      // Add fields if any
      if (data.fields.length > 0) {
        await syncFormFields(form.id, data.fields);
      }

      revalidatePath("/forms");
      return { success: true, formId: form.id };
    }

    // Updating existing form
    if (!user.permissions.canUpdateForms) {
      return { error: "You do not have permission to update forms" };
    }

    // Verify form belongs to org
    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return { error: "Form not found" };
    }

    // Update form metadata
    await updateForm(formId, user.orgId, {
      name: data.name,
      description: data.description,
      type: data.type,
      settings: data.settings,
    });

    // Sync fields
    await syncFormFields(formId, data.fields);

    revalidatePath("/forms");
    revalidatePath(`/forms/${formId}`);
    return { success: true, formId };
  } catch (error) {
    console.error("Error saving form:", error);
    return { error: "Failed to save form" };
  }
}

/**
 * Publish a form
 */
export async function publishFormAction(formId: string): Promise<PublishFormState> {
  try {
    const user = await requireAuth();

    if (!user.permissions.canPublishForms) {
      return { error: "You do not have permission to publish forms" };
    }

    // Verify form belongs to org
    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return { error: "Form not found" };
    }

    // Validate form is ready
    if (!existingForm.name?.trim()) {
      return { error: "Form must have a name to publish" };
    }

    if (existingForm.fields.length === 0) {
      return { error: "Form must have at least one field to publish" };
    }

    const fieldsWithoutNames = existingForm.fields.filter((f) => !f.name?.trim());
    if (fieldsWithoutNames.length > 0) {
      return { error: `${fieldsWithoutNames.length} field(s) are missing names` };
    }

    const result = await publishForm(formId, user.orgId, user.id);

    revalidatePath("/forms");
    revalidatePath(`/forms/${formId}`);
    return { success: true, version: result.version.version };
  } catch (error) {
    console.error("Error publishing form:", error);
    const message = error instanceof Error ? error.message : "Failed to publish form";
    return { error: message };
  }
}

/**
 * Archive a form
 */
export async function archiveFormAction(formId: string): Promise<SaveFormState> {
  try {
    const user = await requireAuth();

    if (!user.permissions.canDeleteForms) {
      return { error: "You do not have permission to archive forms" };
    }

    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return { error: "Form not found" };
    }

    await archiveForm(formId, user.orgId);

    revalidatePath("/forms");
    return { success: true };
  } catch (error) {
    console.error("Error archiving form:", error);
    return { error: "Failed to archive form" };
  }
}

/**
 * Delete a form permanently (only drafts)
 */
export async function deleteFormAction(formId: string): Promise<SaveFormState> {
  try {
    const user = await requireAuth();

    if (!user.permissions.canDeleteForms) {
      return { error: "You do not have permission to delete forms" };
    }

    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return { error: "Form not found" };
    }

    await deleteForm(formId, user.orgId);

    revalidatePath("/forms");
    return { success: true };
  } catch (error) {
    console.error("Error deleting form:", error);
    const message = error instanceof Error ? error.message : "Failed to delete form";
    return { error: message };
  }
}

/**
 * Duplicate a form
 */
export async function duplicateFormAction(
  formId: string,
  newName?: string
): Promise<SaveFormState> {
  try {
    const user = await requireAuth();

    if (!user.permissions.canCreateForms) {
      return { error: "You do not have permission to create forms" };
    }

    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return { error: "Form not found" };
    }

    const newForm = await duplicateForm(formId, user.orgId, user.id, newName);

    revalidatePath("/forms");
    return { success: true, formId: newForm?.id };
  } catch (error) {
    console.error("Error duplicating form:", error);
    return { error: "Failed to duplicate form" };
  }
}

/**
 * Navigate to edit a form
 */
export async function editFormAction(formId: string) {
  redirect(`/forms/${formId}/edit`);
}
