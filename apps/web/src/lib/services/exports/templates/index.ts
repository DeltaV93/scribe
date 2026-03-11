/**
 * Export Template Service
 *
 * CRUD operations for export templates.
 */

import { prisma } from "@/lib/db";
import { ExportType, ExportTemplateStatus, Prisma } from "@prisma/client";
import {
  getPredefinedTemplate,
  getAllPredefinedTemplates,
  getSuggestedMappings,
} from "./predefined";
import { FieldMapping, OutputConfig, ValidationRule, CodeMappings } from "../types";

export { getPredefinedTemplate, getAllPredefinedTemplates, getSuggestedMappings };

// ============================================
// CREATE
// ============================================

export interface CreateTemplateInput {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  exportType: ExportType;
  sourceFormIds: string[];
  fieldMappings: FieldMapping[];
  validationRules?: ValidationRule[];
  outputFormat?: string;
  outputConfig?: Partial<OutputConfig>;
}

/**
 * Create a new export template
 */
export async function createTemplate(input: CreateTemplateInput) {
  const {
    orgId,
    userId,
    name,
    description,
    exportType,
    sourceFormIds,
    fieldMappings,
    validationRules,
    outputFormat = "CSV",
    outputConfig,
  } = input;

  // Get default config from predefined template if available
  const predefined = getPredefinedTemplate(exportType);
  const defaultConfig: OutputConfig = {
    delimiter: predefined?.delimiter || ",",
    encoding: predefined?.encoding || "utf-8",
    includeHeaders: predefined?.includeHeaders ?? true,
    lineEnding: "CRLF",
    quoteChar: '"',
    escapeChar: '"',
    dateFormat: "YYYY-MM-DD",
  };

  const finalConfig = { ...defaultConfig, ...outputConfig };

  const template = await prisma.exportTemplate.create({
    data: {
      orgId,
      name,
      description,
      exportType,
      status: "DRAFT",
      sourceFormIds,
      fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
      validationRules: validationRules as unknown as Prisma.InputJsonValue,
      outputFormat: outputFormat || predefined?.outputFormat || "CSV",
      outputConfig: finalConfig as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return template;
}

/**
 * Create template from predefined type
 */
export async function createFromPredefined(
  orgId: string,
  userId: string,
  exportType: ExportType,
  sourceFormIds: string[],
  customizations?: {
    name?: string;
    description?: string;
    fieldMappingOverrides?: Partial<FieldMapping>[];
  }
) {
  const predefined = getPredefinedTemplate(exportType);
  if (!predefined) {
    throw new Error(`No predefined template for export type: ${exportType}`);
  }

  let fieldMappings = predefined.fields;

  // Apply customizations if provided
  if (customizations?.fieldMappingOverrides) {
    fieldMappings = predefined.fields.map((field) => {
      const override = customizations.fieldMappingOverrides?.find(
        (o) => o.externalField === field.externalField
      );
      return override ? { ...field, ...override } : field;
    });
  }

  return createTemplate({
    orgId,
    userId,
    name: customizations?.name || predefined.name,
    description: customizations?.description || predefined.description,
    exportType,
    sourceFormIds,
    fieldMappings,
    validationRules: predefined.validationRules,
    outputFormat: predefined.outputFormat,
    outputConfig: {
      delimiter: predefined.delimiter || ",",
      encoding: predefined.encoding || "utf-8",
      includeHeaders: predefined.includeHeaders ?? true,
      lineEnding: "CRLF",
    },
  });
}

// ============================================
// READ
// ============================================

/**
 * Get template by ID
 */
export async function getTemplate(templateId: string, orgId: string) {
  const template = await prisma.exportTemplate.findFirst({
    where: {
      id: templateId,
      orgId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      exports: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          recordCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!template) {
    return null;
  }

  // Add code mappings from predefined template
  const predefined = getPredefinedTemplate(template.exportType);
  const codeMappings = predefined?.codeMappings || {};

  return {
    ...template,
    codeMappings,
  };
}

/**
 * List templates for an organization
 */
export async function listTemplates(
  orgId: string,
  options?: {
    status?: ExportTemplateStatus;
    exportType?: ExportType;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.ExportTemplateWhereInput = {
    orgId,
    ...(options?.status && { status: options.status }),
    ...(options?.exportType && { exportType: options.exportType }),
  };

  const [templates, total] = await Promise.all([
    prisma.exportTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { exports: true },
        },
      },
    }),
    prisma.exportTemplate.count({ where }),
  ]);

  return { templates, total };
}

// ============================================
// UPDATE
// ============================================

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  sourceFormIds?: string[];
  fieldMappings?: FieldMapping[];
  validationRules?: ValidationRule[];
  outputConfig?: Partial<OutputConfig>;
  scheduleEnabled?: boolean;
  scheduleCron?: string;
}

/**
 * Update an export template
 */
export async function updateTemplate(
  templateId: string,
  orgId: string,
  input: UpdateTemplateInput
) {
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  // Don't allow editing active templates directly - they should be archived first
  if (template.status === "ACTIVE" && (input.fieldMappings || input.sourceFormIds)) {
    throw new Error("Cannot modify field mappings on active template. Archive it first.");
  }

  const data: Prisma.ExportTemplateUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.sourceFormIds !== undefined) data.sourceFormIds = input.sourceFormIds;
  if (input.fieldMappings !== undefined) {
    data.fieldMappings = input.fieldMappings as unknown as Prisma.InputJsonValue;
  }
  if (input.validationRules !== undefined) {
    data.validationRules = input.validationRules as unknown as Prisma.InputJsonValue;
  }
  if (input.outputConfig !== undefined) {
    const currentConfig = template.outputConfig as OutputConfig | null;
    data.outputConfig = {
      ...currentConfig,
      ...input.outputConfig,
    } as unknown as Prisma.InputJsonValue;
  }
  if (input.scheduleEnabled !== undefined) data.scheduleEnabled = input.scheduleEnabled;
  if (input.scheduleCron !== undefined) data.scheduleCron = input.scheduleCron;

  return prisma.exportTemplate.update({
    where: { id: templateId },
    data,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Activate a template (move from DRAFT to ACTIVE)
 */
export async function activateTemplate(templateId: string, orgId: string) {
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (template.status !== "DRAFT") {
    throw new Error("Only draft templates can be activated");
  }

  // Validate template has required configuration
  const fieldMappings = template.fieldMappings as unknown as FieldMapping[];
  if (!fieldMappings || fieldMappings.length === 0) {
    throw new Error("Template must have at least one field mapping");
  }

  if (!template.sourceFormIds || template.sourceFormIds.length === 0) {
    throw new Error("Template must have at least one source form");
  }

  return prisma.exportTemplate.update({
    where: { id: templateId },
    data: { status: "ACTIVE" },
  });
}

/**
 * Archive a template
 */
export async function archiveTemplate(templateId: string, orgId: string) {
  return prisma.exportTemplate.update({
    where: { id: templateId, orgId },
    data: { status: "ARCHIVED" },
  });
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a template (soft delete by archiving, or hard delete if no exports)
 */
export async function deleteTemplate(
  templateId: string,
  orgId: string,
  hardDelete: boolean = false
) {
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
    include: {
      _count: { select: { exports: true } },
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  // If template has exports, only allow soft delete
  if (template._count.exports > 0 && hardDelete) {
    throw new Error("Cannot hard delete template with existing exports. Use soft delete.");
  }

  if (hardDelete) {
    await prisma.exportTemplate.delete({
      where: { id: templateId },
    });
    return { deleted: true };
  }

  // Soft delete by archiving
  await archiveTemplate(templateId, orgId);
  return { archived: true };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate template configuration
 */
export async function validateTemplateConfig(
  orgId: string,
  config: {
    exportType: ExportType;
    sourceFormIds: string[];
    fieldMappings: FieldMapping[];
  }
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check export type
  const predefined = getPredefinedTemplate(config.exportType);

  // Validate source forms exist
  const forms = await prisma.form.findMany({
    where: {
      id: { in: config.sourceFormIds },
      orgId,
    },
    include: {
      fields: {
        select: { slug: true },
      },
    },
  });

  if (forms.length !== config.sourceFormIds.length) {
    errors.push("One or more source forms not found");
  }

  // Collect all available form field slugs
  const availableFieldSlugs = new Set<string>();
  forms.forEach((form) => {
    form.fields.forEach((field) => {
      availableFieldSlugs.add(`form:${field.slug}`);
    });
  });

  // Validate field mappings
  for (const mapping of config.fieldMappings) {
    if (!mapping.externalField) {
      errors.push("Field mapping missing external field name");
      continue;
    }

    if (!mapping.scrybeField) {
      errors.push(`Field mapping for ${mapping.externalField} missing Scrybe field`);
      continue;
    }

    // Check if Scrybe field exists (for form fields)
    if (mapping.scrybeField.startsWith("form:")) {
      if (!availableFieldSlugs.has(mapping.scrybeField)) {
        warnings.push(
          `Field ${mapping.scrybeField} not found in source forms for ${mapping.externalField}`
        );
      }
    }
  }

  // Check required fields from predefined template
  if (predefined) {
    const configuredExternalFields = new Set(config.fieldMappings.map((m) => m.externalField));
    const missingRequired = predefined.fields.filter(
      (f) => f.required && !configuredExternalFields.has(f.externalField)
    );

    for (const missing of missingRequired) {
      warnings.push(`Required field ${missing.externalField} not configured`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// FIELD MAPPING HELPERS
// ============================================

/**
 * Get available Scrybe fields for mapping
 */
export async function getAvailableFields(orgId: string, formIds: string[]): Promise<{
  clientFields: Array<{ path: string; label: string; type: string }>;
  formFields: Array<{ path: string; label: string; type: string; formId: string; formName: string }>;
  programFields: Array<{ path: string; label: string; type: string }>;
  enrollmentFields: Array<{ path: string; label: string; type: string }>;
}> {
  // Standard client fields
  const clientFields = [
    { path: "client.id", label: "Client ID", type: "string" },
    { path: "client.firstName", label: "First Name", type: "string" },
    { path: "client.lastName", label: "Last Name", type: "string" },
    { path: "client.phone", label: "Phone", type: "phone" },
    { path: "client.email", label: "Email", type: "email" },
    { path: "client.address.street", label: "Address - Street", type: "string" },
    { path: "client.address.city", label: "Address - City", type: "string" },
    { path: "client.address.state", label: "Address - State", type: "string" },
    { path: "client.address.zip", label: "Address - ZIP", type: "string" },
    { path: "client.internalId", label: "Internal ID", type: "string" },
    { path: "client.status", label: "Client Status", type: "enum" },
    { path: "client.createdAt", label: "Client Created Date", type: "date" },
  ];

  // Get form fields from specified forms
  const forms = await prisma.form.findMany({
    where: {
      id: { in: formIds },
      orgId,
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  const formFields = forms.flatMap((form) =>
    form.fields.map((field) => ({
      path: `form:${field.slug}`,
      label: field.name,
      type: field.type.toLowerCase(),
      formId: form.id,
      formName: form.name,
    }))
  );

  // Program fields
  const programFields = [
    { path: "program.id", label: "Program ID", type: "string" },
    { path: "program.name", label: "Program Name", type: "string" },
    { path: "program.labelType", label: "Program Type", type: "enum" },
    { path: "program.startDate", label: "Program Start Date", type: "date" },
    { path: "program.endDate", label: "Program End Date", type: "date" },
    { path: "program.location", label: "Program Location", type: "string" },
  ];

  // Enrollment fields
  const enrollmentFields = [
    { path: "enrollment.id", label: "Enrollment ID", type: "string" },
    { path: "enrollment.enrolledDate", label: "Enrollment Date", type: "date" },
    { path: "enrollment.status", label: "Enrollment Status", type: "enum" },
    { path: "enrollment.completionDate", label: "Completion Date", type: "date" },
    { path: "enrollment.withdrawalDate", label: "Withdrawal Date", type: "date" },
    { path: "enrollment.totalHours", label: "Total Hours", type: "number" },
  ];

  return {
    clientFields,
    formFields,
    programFields,
    enrollmentFields,
  };
}
