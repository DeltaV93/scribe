import { prisma } from "@/lib/db";
import {
  FormStatus,
  FormType,
  FieldType,
  FieldPurpose,
  type FormSettings,
  type FormFieldData,
  type FieldOption,
  type ConditionalLogic,
  type FieldTranslation,
} from "@/types";
import type { Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateFormInput {
  orgId: string;
  createdById: string;
  name: string;
  description?: string | null;
  type: FormType;
  settings?: Partial<FormSettings>;
}

export interface UpdateFormInput {
  name?: string;
  description?: string | null;
  type?: FormType;
  settings?: Partial<FormSettings>;
}

export interface CreateFieldInput {
  formId: string;
  slug: string;
  name: string;
  type: FieldType;
  purpose: FieldPurpose;
  purposeNote?: string | null;
  helpText?: string | null;
  isRequired?: boolean;
  isSensitive?: boolean;
  isAiExtractable?: boolean;
  options?: FieldOption[] | null;
  section?: string | null;
  order: number;
  conditionalLogic?: ConditionalLogic | null;
}

export interface UpdateFieldInput {
  slug?: string;
  name?: string;
  type?: FieldType;
  purpose?: FieldPurpose;
  purposeNote?: string | null;
  helpText?: string | null;
  isRequired?: boolean;
  isSensitive?: boolean;
  isAiExtractable?: boolean;
  options?: FieldOption[] | null;
  section?: string | null;
  order?: number;
  conditionalLogic?: ConditionalLogic | null;
}

export interface FormWithFields {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  type: FormType;
  status: FormStatus;
  version: number;
  settings: FormSettings;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  publishedAt: Date | null;
  fields: FormFieldData[];
}

// ============================================
// FORM CRUD
// ============================================

/**
 * Create a new form
 */
const DEFAULT_FORM_SETTINGS: FormSettings = {
  allowPartialSaves: true,
  requireSupervisorReview: false,
  autoArchiveDays: null,
  activityTriggers: ["submissions"],
};

export async function createForm(input: CreateFormInput) {
  const settings: FormSettings = {
    ...DEFAULT_FORM_SETTINGS,
    ...input.settings,
  };

  const form = await prisma.form.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.name,
      description: input.description,
      type: input.type,
      settings: settings as unknown as Prisma.InputJsonValue,
      status: FormStatus.DRAFT,
      version: 1,
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  return transformForm(form);
}

/**
 * Get a form by ID with all fields
 */
export async function getFormById(
  formId: string,
  orgId: string
): Promise<FormWithFields | null> {
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      orgId: orgId,
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) return null;

  return transformForm(form);
}

/**
 * List forms for an organization
 */
export async function listForms(
  orgId: string,
  options?: {
    status?: FormStatus;
    type?: FormType;
    page?: number;
    pageSize?: number;
    search?: string;
  }
) {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.FormWhereInput = {
    orgId,
    ...(options?.status && { status: options.status }),
    ...(options?.type && { type: options.type }),
    ...(options?.search && {
      OR: [
        { name: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ],
    }),
  };

  const [forms, total] = await Promise.all([
    prisma.form.findMany({
      where,
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.form.count({ where }),
  ]);

  return {
    forms: forms.map((form) => ({
      ...transformForm(form),
      createdBy: form.createdBy,
      submissionCount: form._count.submissions,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Update a form's metadata
 */
export async function updateForm(
  formId: string,
  orgId: string,
  input: UpdateFormInput
) {
  // If settings are being updated, merge with existing
  let settingsUpdate: object | undefined;
  if (input.settings !== undefined) {
    const existingForm = await prisma.form.findUnique({
      where: { id: formId },
      select: { settings: true },
    });
    const existingSettings = (existingForm?.settings as unknown as FormSettings) || {};
    settingsUpdate = { ...existingSettings, ...input.settings };
  }

  const form = await prisma.form.update({
    where: {
      id: formId,
      orgId: orgId,
    },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.type !== undefined && { type: input.type }),
      ...(settingsUpdate !== undefined && { settings: settingsUpdate }),
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  return transformForm(form);
}

/**
 * Delete a form (soft delete by archiving)
 */
export async function archiveForm(formId: string, orgId: string) {
  const form = await prisma.form.update({
    where: {
      id: formId,
      orgId: orgId,
    },
    data: {
      status: FormStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });

  return form;
}

/**
 * Permanently delete a form (only if draft)
 */
export async function deleteForm(formId: string, orgId: string) {
  // First check if form is a draft
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      orgId: orgId,
    },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  if (form.status !== FormStatus.DRAFT) {
    throw new Error("Only draft forms can be permanently deleted");
  }

  await prisma.form.delete({
    where: { id: formId },
  });

  return true;
}

// ============================================
// FIELD CRUD
// ============================================

/**
 * Add a field to a form
 */
export async function addField(input: CreateFieldInput) {
  const field = await prisma.formField.create({
    data: {
      formId: input.formId,
      slug: input.slug,
      name: input.name,
      type: input.type,
      purpose: input.purpose,
      purposeNote: input.purposeNote,
      helpText: input.helpText,
      isRequired: input.isRequired ?? false,
      isSensitive: input.isSensitive ?? false,
      isAiExtractable: input.isAiExtractable ?? true,
      options: input.options as unknown as Prisma.InputJsonValue | undefined,
      section: input.section,
      order: input.order,
      conditionalLogic: input.conditionalLogic as unknown as Prisma.InputJsonValue | undefined,
    },
  });

  return transformField(field);
}

/**
 * Update a field
 */
export async function updateField(fieldId: string, input: UpdateFieldInput) {
  const field = await prisma.formField.update({
    where: { id: fieldId },
    data: {
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.purpose !== undefined && { purpose: input.purpose }),
      ...(input.purposeNote !== undefined && { purposeNote: input.purposeNote }),
      ...(input.helpText !== undefined && { helpText: input.helpText }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.isSensitive !== undefined && { isSensitive: input.isSensitive }),
      ...(input.isAiExtractable !== undefined && {
        isAiExtractable: input.isAiExtractable,
      }),
      ...(input.options !== undefined && { options: input.options as unknown as Prisma.InputJsonValue }),
      ...(input.section !== undefined && { section: input.section }),
      ...(input.order !== undefined && { order: input.order }),
      ...(input.conditionalLogic !== undefined && {
        conditionalLogic: input.conditionalLogic as unknown as Prisma.InputJsonValue,
      }),
    },
  });

  return transformField(field);
}

/**
 * Delete a field
 */
export async function deleteField(fieldId: string) {
  await prisma.formField.delete({
    where: { id: fieldId },
  });

  return true;
}

/**
 * Bulk update field orders
 */
export async function reorderFields(
  formId: string,
  fieldOrders: { id: string; order: number }[]
) {
  await prisma.$transaction(
    fieldOrders.map(({ id, order }) =>
      prisma.formField.update({
        where: { id, formId },
        data: { order },
      })
    )
  );

  return true;
}

/**
 * Bulk create/update/delete fields (for save operation)
 */
export async function syncFormFields(
  formId: string,
  fields: FormFieldData[]
) {
  // Get existing field IDs
  const existingFields = await prisma.formField.findMany({
    where: { formId },
    select: { id: true },
  });
  const existingIds = new Set(existingFields.map((f) => f.id));

  // Determine which fields to create, update, or delete
  const toCreate: CreateFieldInput[] = [];
  const toUpdate: { id: string; data: UpdateFieldInput }[] = [];
  const incomingIds = new Set<string>();

  for (const field of fields) {
    incomingIds.add(field.id);

    if (existingIds.has(field.id)) {
      // Update existing field
      toUpdate.push({
        id: field.id,
        data: {
          slug: field.slug,
          name: field.name,
          type: field.type,
          purpose: field.purpose,
          purposeNote: field.purposeNote,
          helpText: field.helpText,
          isRequired: field.isRequired,
          isSensitive: field.isSensitive,
          isAiExtractable: field.isAiExtractable,
          options: field.options,
          section: field.section,
          order: field.order,
          conditionalLogic: field.conditionalLogic,
        },
      });
    } else {
      // Create new field
      toCreate.push({
        formId,
        slug: field.slug,
        name: field.name,
        type: field.type,
        purpose: field.purpose,
        purposeNote: field.purposeNote,
        helpText: field.helpText,
        isRequired: field.isRequired,
        isSensitive: field.isSensitive,
        isAiExtractable: field.isAiExtractable,
        options: field.options,
        section: field.section,
        order: field.order,
        conditionalLogic: field.conditionalLogic,
      });
    }
  }

  // Find fields to delete (exist in DB but not in incoming)
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));

  // Execute all operations in a transaction
  await prisma.$transaction([
    // Delete removed fields
    prisma.formField.deleteMany({
      where: { id: { in: toDelete } },
    }),
    // Create new fields
    ...toCreate.map((field) =>
      prisma.formField.create({
        data: {
          ...field,
          options: field.options as unknown as Prisma.InputJsonValue | undefined,
          conditionalLogic: field.conditionalLogic as unknown as Prisma.InputJsonValue | undefined,
        },
      })
    ),
    // Update existing fields
    ...toUpdate.map(({ id, data }) =>
      prisma.formField.update({
        where: { id },
        data: {
          ...data,
          options: data.options as unknown as Prisma.InputJsonValue | undefined,
          conditionalLogic: data.conditionalLogic as unknown as Prisma.InputJsonValue | undefined,
        },
      })
    ),
  ]);

  // Return updated form with fields
  return getFormById(formId, ""); // orgId check bypassed for internal use
}

// ============================================
// VERSIONING & PUBLISHING
// ============================================

/**
 * Publish a form (creates a version snapshot)
 */
export async function publishForm(
  formId: string,
  orgId: string,
  userId: string
) {
  // Get the current form with all fields
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      orgId: orgId,
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  if (form.status === FormStatus.ARCHIVED) {
    throw new Error("Cannot publish an archived form");
  }

  // Create snapshot of current form state
  const snapshot = {
    name: form.name,
    description: form.description,
    type: form.type,
    settings: form.settings,
    fields: form.fields.map((field) => ({
      id: field.id,
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose,
      purposeNote: field.purposeNote,
      helpText: field.helpText,
      isRequired: field.isRequired,
      isSensitive: field.isSensitive,
      isAiExtractable: field.isAiExtractable,
      options: field.options,
      section: field.section,
      order: field.order,
      conditionalLogic: field.conditionalLogic,
    })),
  };

  // Generate AI extraction prompt from fields
  const aiExtractionPrompt = generateAIExtractionPrompt(form.fields);

  // Determine new version number
  const latestVersion = await prisma.formVersion.findFirst({
    where: { formId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const newVersion = (latestVersion?.version || 0) + 1;

  // Create version and update form in transaction
  const [version, updatedForm] = await prisma.$transaction([
    prisma.formVersion.create({
      data: {
        formId,
        version: newVersion,
        snapshot,
        aiExtractionPrompt,
        publishedById: userId,
      },
    }),
    prisma.form.update({
      where: { id: formId },
      data: {
        status: FormStatus.PUBLISHED,
        version: newVersion,
        publishedAt: new Date(),
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    }),
  ]);

  return {
    form: transformForm(updatedForm),
    version: {
      id: version.id,
      version: version.version,
      publishedAt: version.publishedAt,
    },
  };
}

/**
 * Get all versions of a form
 */
export async function getFormVersions(formId: string, orgId: string) {
  // Verify form belongs to org
  const form = await prisma.form.findFirst({
    where: { id: formId, orgId },
    select: { id: true },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  const versions = await prisma.formVersion.findMany({
    where: { formId },
    orderBy: { version: "desc" },
    include: {
      publishedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
  });

  return versions.map((v) => ({
    id: v.id,
    version: v.version,
    publishedAt: v.publishedAt,
    publishedBy: v.publishedBy,
    submissionCount: v._count.submissions,
  }));
}

/**
 * Get a specific form version
 */
export async function getFormVersion(versionId: string) {
  const version = await prisma.formVersion.findUnique({
    where: { id: versionId },
    include: {
      publishedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!version) {
    throw new Error("Version not found");
  }

  return {
    id: version.id,
    version: version.version,
    snapshot: version.snapshot,
    aiExtractionPrompt: version.aiExtractionPrompt,
    publishedAt: version.publishedAt,
    publishedBy: version.publishedBy,
  };
}

/**
 * Revert to a previous version (creates new draft based on version snapshot)
 */
export async function revertToVersion(
  formId: string,
  versionId: string,
  orgId: string
) {
  // Get the version
  const version = await prisma.formVersion.findFirst({
    where: {
      id: versionId,
      formId,
      form: { orgId },
    },
  });

  if (!version) {
    throw new Error("Version not found");
  }

  const snapshot = version.snapshot as unknown as {
    name: string;
    description: string | null;
    type: FormType;
    settings: FormSettings;
    fields: Array<{
      slug: string;
      name: string;
      type: FieldType;
      purpose: FieldPurpose;
      purposeNote: string | null;
      helpText: string | null;
      isRequired: boolean;
      isSensitive: boolean;
      isAiExtractable: boolean;
      options: FieldOption[] | null;
      section: string | null;
      order: number;
      conditionalLogic: ConditionalLogic | null;
    }>;
  };

  // Update form and replace all fields in transaction
  await prisma.$transaction([
    // Delete all current fields
    prisma.formField.deleteMany({ where: { formId } }),
    // Update form metadata
    prisma.form.update({
      where: { id: formId },
      data: {
        name: snapshot.name,
        description: snapshot.description,
        type: snapshot.type,
        settings: snapshot.settings as unknown as Prisma.InputJsonValue,
        status: FormStatus.DRAFT, // Revert puts form back in draft
      },
    }),
    // Create fields from snapshot
    ...snapshot.fields.map((field) =>
      prisma.formField.create({
        data: {
          formId,
          slug: field.slug,
          name: field.name,
          type: field.type,
          purpose: field.purpose,
          purposeNote: field.purposeNote,
          helpText: field.helpText,
          isRequired: field.isRequired,
          isSensitive: field.isSensitive,
          isAiExtractable: field.isAiExtractable,
          options: field.options as unknown as Prisma.InputJsonValue | undefined,
          section: field.section,
          order: field.order,
          conditionalLogic: field.conditionalLogic as unknown as Prisma.InputJsonValue | undefined,
        },
      })
    ),
  ]);

  return getFormById(formId, orgId);
}

// ============================================
// DUPLICATE / TEMPLATE
// ============================================

/**
 * Duplicate a form
 */
export async function duplicateForm(
  formId: string,
  orgId: string,
  userId: string,
  newName?: string
) {
  const sourceForm = await getFormById(formId, orgId);

  if (!sourceForm) {
    throw new Error("Form not found");
  }

  // Create new form
  const newForm = await prisma.form.create({
    data: {
      orgId,
      createdById: userId,
      name: newName || `${sourceForm.name} (Copy)`,
      description: sourceForm.description,
      type: sourceForm.type,
      settings: sourceForm.settings as unknown as Prisma.InputJsonValue,
      status: FormStatus.DRAFT,
      version: 1,
    },
  });

  // Create fields
  await prisma.formField.createMany({
    data: sourceForm.fields.map((field) => ({
      formId: newForm.id,
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose,
      purposeNote: field.purposeNote,
      helpText: field.helpText,
      isRequired: field.isRequired,
      isSensitive: field.isSensitive,
      isAiExtractable: field.isAiExtractable,
      options: field.options as unknown as Prisma.InputJsonValue | undefined,
      section: field.section,
      order: field.order,
      conditionalLogic: field.conditionalLogic as unknown as Prisma.InputJsonValue | undefined,
    })),
  });

  return getFormById(newForm.id, orgId);
}

// ============================================
// HELPERS
// ============================================

function transformForm(form: {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  version: number;
  settings: unknown;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  publishedAt: Date | null;
  fields: Array<{
    id: string;
    formId: string;
    slug: string;
    name: string;
    type: string;
    purpose: string;
    purposeNote: string | null;
    helpText: string | null;
    isRequired: boolean;
    isSensitive: boolean;
    isAiExtractable: boolean;
    options: unknown;
    section: string | null;
    order: number;
    conditionalLogic: unknown;
    translations?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): FormWithFields {
  return {
    id: form.id,
    orgId: form.orgId,
    name: form.name,
    description: form.description,
    type: form.type as FormType,
    status: form.status as FormStatus,
    version: form.version,
    settings: form.settings as FormSettings,
    createdById: form.createdById,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    archivedAt: form.archivedAt,
    publishedAt: form.publishedAt,
    fields: form.fields.map(transformField),
  };
}

function transformField(field: {
  id: string;
  formId: string;
  slug: string;
  name: string;
  type: string;
  purpose: string;
  purposeNote: string | null;
  helpText: string | null;
  isRequired: boolean;
  isSensitive: boolean;
  isAiExtractable: boolean;
  options: unknown;
  section: string | null;
  order: number;
  conditionalLogic: unknown;
  translations?: unknown;
  createdAt: Date;
  updatedAt: Date;
}): FormFieldData {
  return {
    id: field.id,
    formId: field.formId,
    slug: field.slug,
    name: field.name,
    type: field.type as FieldType,
    purpose: field.purpose as FieldPurpose,
    purposeNote: field.purposeNote,
    helpText: field.helpText,
    isRequired: field.isRequired,
    isSensitive: field.isSensitive,
    isAiExtractable: field.isAiExtractable,
    options: field.options as FieldOption[] | null,
    section: field.section,
    order: field.order,
    conditionalLogic: field.conditionalLogic as ConditionalLogic | null,
    translations: field.translations as unknown as Record<string, FieldTranslation> | null,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
  };
}

/**
 * Generate AI extraction prompt from form fields
 */
function generateAIExtractionPrompt(
  fields: Array<{
    slug: string;
    name: string;
    type: string;
    helpText: string | null;
    isAiExtractable: boolean;
    options: unknown;
  }>
): string {
  const extractableFields = fields.filter((f) => f.isAiExtractable);

  if (extractableFields.length === 0) {
    return "No fields configured for AI extraction.";
  }

  const fieldDescriptions = extractableFields
    .map((field) => {
      let desc = `- "${field.slug}" (${field.name}): ${field.type}`;
      if (field.helpText) {
        desc += ` - ${field.helpText}`;
      }
      if (field.options && Array.isArray(field.options)) {
        const options = field.options as FieldOption[];
        desc += ` [Options: ${options.map((o) => o.label).join(", ")}]`;
      }
      return desc;
    })
    .join("\n");

  return `You are extracting information from a client intake call transcript.

Extract values for the following fields:
${fieldDescriptions}

Instructions:
1. Only extract information that is explicitly stated in the transcript
2. If a value is not mentioned or unclear, set it to null
3. For dropdown/checkbox fields, only use the provided options
4. For dates, use ISO format (YYYY-MM-DD)
5. For phone numbers, use format: (XXX) XXX-XXXX
6. For addresses, extract all available components

Return a JSON object with field slugs as keys and extracted values.
Include a "confidence" object with confidence scores (0-100) for each field.
Include a "flagged" array of field slugs that need human review.`;
}
