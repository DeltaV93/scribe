/**
 * Report Template Registry
 *
 * Central registry for all report templates including funder-specific formats.
 */

import { ReportType } from "@prisma/client";
import { FunderTemplateDefinition } from "../types";
import { outcomeSummaryTemplate } from "./outcome-summary";
import { serviceDeliveryTemplate } from "./service-delivery";
import { complianceTemplate } from "./compliance";

// ============================================
// TEMPLATE REGISTRY
// ============================================

export const REPORT_TEMPLATES: FunderTemplateDefinition[] = [
  outcomeSummaryTemplate,
  serviceDeliveryTemplate,
  complianceTemplate,
];

/**
 * Get all available templates
 */
export function getAllTemplates(): FunderTemplateDefinition[] {
  return REPORT_TEMPLATES;
}

/**
 * Get templates by report type
 */
export function getTemplatesByType(
  reportType: ReportType
): FunderTemplateDefinition[] {
  return REPORT_TEMPLATES.filter((t) => t.reportType === reportType);
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(
  templateId: string
): FunderTemplateDefinition | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Get templates by funder name
 */
export function getTemplatesByFunder(
  funderName: string
): FunderTemplateDefinition[] {
  return REPORT_TEMPLATES.filter(
    (t) => t.funderName.toLowerCase() === funderName.toLowerCase()
  );
}

/**
 * Get unique funder names
 */
export function getUniqueFunders(): string[] {
  const funders = new Set(REPORT_TEMPLATES.map((t) => t.funderName));
  return Array.from(funders).sort();
}

/**
 * Validate that a template has all required metrics and sections
 */
export function validateTemplateRequirements(
  templateId: string,
  selectedMetricIds: string[],
  selectedSectionTypes: string[]
): {
  valid: boolean;
  missingMetrics: string[];
  missingSections: string[];
} {
  const template = getTemplateById(templateId);

  if (!template) {
    return {
      valid: false,
      missingMetrics: [],
      missingSections: [],
    };
  }

  const missingMetrics = template.requiredMetrics.filter(
    (m) => !selectedMetricIds.includes(m)
  );

  const missingSections = template.requiredSections.filter(
    (s) => !selectedSectionTypes.includes(s)
  );

  return {
    valid: missingMetrics.length === 0 && missingSections.length === 0,
    missingMetrics,
    missingSections,
  };
}

// Re-export template definitions
export { outcomeSummaryTemplate } from "./outcome-summary";
export { serviceDeliveryTemplate } from "./service-delivery";
export { complianceTemplate } from "./compliance";
