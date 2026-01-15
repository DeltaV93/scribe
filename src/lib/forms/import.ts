import { z } from "zod";
import { FieldType, FieldPurpose, FormType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { EXPORT_VERSION, type FormExport } from "./export";

/**
 * Validation result for imported forms
 */
export interface ImportValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: FormExport;
}

/**
 * Import options
 */
export interface ImportOptions {
  name?: string; // Override the form name
  skipDuplicateSlugs?: boolean; // Skip fields with duplicate slugs
  mapFields?: Record<string, string>; // Map field slugs to new slugs
}

// Schema for validating imported form structure
const fieldSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(FieldType),
  purpose: z.nativeEnum(FieldPurpose),
  purposeNote: z.string().max(500).nullable().optional(),
  helpText: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  isAiExtractable: z.boolean().default(true),
  options: z.unknown().nullable().optional(),
  section: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0),
  conditionalLogic: z.unknown().nullable().optional(),
  translations: z.unknown().nullable().optional(),
});

const formExportSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  form: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    type: z.nativeEnum(FormType),
    settings: z.unknown().optional(),
  }),
  fields: z.array(fieldSchema),
  metadata: z.object({
    fieldCount: z.number(),
    sections: z.array(z.string()),
  }).optional(),
});

/**
 * Validate an imported form structure
 */
export function validateImport(data: unknown): ImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if it's valid JSON/object
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      errors: ["Invalid import data: expected an object"],
      warnings: [],
    };
  }

  // Validate against schema
  const result = formExportSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ),
      warnings: [],
    };
  }

  const formData = result.data;

  // Version compatibility check
  const [major] = formData.version.split(".");
  const [currentMajor] = EXPORT_VERSION.split(".");

  if (major !== currentMajor) {
    warnings.push(
      `Import version (${formData.version}) differs from current version (${EXPORT_VERSION}). Some features may not be compatible.`
    );
  }

  // Check for duplicate field slugs
  const slugs = new Set<string>();
  for (const field of formData.fields) {
    if (slugs.has(field.slug)) {
      errors.push(`Duplicate field slug: ${field.slug}`);
    }
    slugs.add(field.slug);
  }

  // Validate field order continuity
  const orders = formData.fields.map((f) => f.order).sort((a, b) => a - b);
  const hasGaps = orders.some((order, i) => i > 0 && order > orders[i - 1] + 1);
  if (hasGaps) {
    warnings.push("Field order has gaps. Fields will be reordered sequentially.");
  }

  // Check for sensitive fields
  const sensitiveFields = formData.fields.filter((f) => f.isSensitive);
  if (sensitiveFields.length > 0) {
    warnings.push(
      `Form contains ${sensitiveFields.length} sensitive field(s). Ensure encryption is properly configured.`
    );
  }

  // Check conditional logic references
  for (const field of formData.fields) {
    if (field.conditionalLogic) {
      const logic = field.conditionalLogic as { conditions?: Array<{ fieldSlug?: string }> };
      if (logic.conditions) {
        for (const condition of logic.conditions) {
          if (condition.fieldSlug && !slugs.has(condition.fieldSlug)) {
            warnings.push(
              `Field "${field.slug}" has conditional logic referencing unknown field "${condition.fieldSlug}"`
            );
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: formData as FormExport,
  };
}

/**
 * Import a form from exported data
 */
export async function importForm(
  orgId: string,
  userId: string,
  importData: FormExport,
  options: ImportOptions = {}
): Promise<{ formId: string; fieldCount: number }> {
  const { name, skipDuplicateSlugs, mapFields } = options;

  // Prepare fields with optional slug mapping
  let fields = importData.fields.map((field, index) => ({
    ...field,
    slug: mapFields?.[field.slug] || field.slug,
    order: index, // Ensure sequential ordering
  }));

  // Handle duplicate slugs if requested
  if (skipDuplicateSlugs) {
    const seenSlugs = new Set<string>();
    fields = fields.filter((field) => {
      if (seenSlugs.has(field.slug)) {
        return false;
      }
      seenSlugs.add(field.slug);
      return true;
    });
  }

  // Create form and fields in a transaction
  const form = await prisma.$transaction(async (tx) => {
    // Create the form
    const newForm = await tx.form.create({
      data: {
        orgId,
        name: name || importData.form.name,
        description: importData.form.description,
        type: importData.form.type as FormType,
        settings: importData.form.settings || {},
        createdById: userId,
      },
    });

    // Create fields
    if (fields.length > 0) {
      await tx.formField.createMany({
        data: fields.map((field) => ({
          formId: newForm.id,
          slug: field.slug,
          name: field.name,
          type: field.type as FieldType,
          purpose: field.purpose as FieldPurpose,
          purposeNote: field.purposeNote ?? null,
          helpText: field.helpText ?? null,
          isRequired: field.isRequired,
          isSensitive: field.isSensitive,
          isAiExtractable: field.isAiExtractable,
          options: field.options as Prisma.InputJsonValue | undefined,
          section: field.section ?? null,
          order: field.order,
          conditionalLogic: field.conditionalLogic as Prisma.InputJsonValue | undefined,
          translations: field.translations as Prisma.InputJsonValue | undefined,
        })),
      });
    }

    return newForm;
  });

  return {
    formId: form.id,
    fieldCount: fields.length,
  };
}

/**
 * Preview what will be imported without actually importing
 */
export function previewImport(
  importData: FormExport,
  options: ImportOptions = {}
): {
  form: { name: string; type: string };
  fieldCount: number;
  sections: string[];
  fieldTypes: Record<string, number>;
} {
  const { name, skipDuplicateSlugs, mapFields } = options;

  let fields = importData.fields.map((field) => ({
    ...field,
    slug: mapFields?.[field.slug] || field.slug,
  }));

  if (skipDuplicateSlugs) {
    const seenSlugs = new Set<string>();
    fields = fields.filter((field) => {
      if (seenSlugs.has(field.slug)) {
        return false;
      }
      seenSlugs.add(field.slug);
      return true;
    });
  }

  const sections = Array.from(
    new Set(fields.map((f) => f.section).filter(Boolean))
  ) as string[];

  const fieldTypes = fields.reduce(
    (acc, field) => {
      acc[field.type] = (acc[field.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    form: {
      name: name || importData.form.name,
      type: importData.form.type,
    },
    fieldCount: fields.length,
    sections,
    fieldTypes,
  };
}
