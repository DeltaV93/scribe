/**
 * Compliance/Audit Report Template
 *
 * Template for compliance and audit-ready reports.
 */

import { FunderTemplateDefinition } from "../types";

export const complianceTemplate: FunderTemplateDefinition = {
  id: "compliance-audit",
  name: "Compliance & Audit Report",
  funderName: "General",
  reportType: "CUSTOM",
  description:
    "Audit-ready compliance report with detailed documentation of service delivery, data integrity checks, and regulatory compliance metrics.",
  version: "1.0",

  requiredMetrics: [
    "general_clients_served",
    "general_program_completions",
  ],

  requiredSections: ["executive_summary", "outcomes_analysis"],

  outputFormat: ["pdf"],

  validationRules: [
    {
      field: "reportingPeriodStart",
      rule: "required",
      message: "Reporting period start date is required",
    },
    {
      field: "reportingPeriodEnd",
      rule: "required",
      message: "Reporting period end date is required",
    },
    {
      field: "certifiedBy",
      rule: "required",
      message: "Compliance reports must be certified by an authorized user",
    },
  ],
};

/**
 * Get compliance-specific metric categories
 */
export function getComplianceMetricCategories(): Array<{
  category: string;
  label: string;
  metrics: string[];
  required: boolean;
}> {
  return [
    {
      category: "data_quality",
      label: "Data Quality Metrics",
      metrics: [
        "data_completeness_rate",
        "data_timeliness_rate",
        "error_correction_rate",
      ],
      required: true,
    },
    {
      category: "service_documentation",
      label: "Service Documentation",
      metrics: [
        "general_clients_served",
        "general_total_hours",
        "notes_per_client",
      ],
      required: true,
    },
    {
      category: "regulatory",
      label: "Regulatory Compliance",
      metrics: [
        "consent_documentation_rate",
        "privacy_compliance_rate",
        "eligibility_verification_rate",
      ],
      required: false,
    },
  ];
}

/**
 * Get compliance checklist items
 */
export function getComplianceChecklist(): Array<{
  id: string;
  category: string;
  item: string;
  required: boolean;
}> {
  return [
    {
      id: "data_backup",
      category: "Data Security",
      item: "Data backup procedures documented and tested",
      required: true,
    },
    {
      id: "access_controls",
      category: "Data Security",
      item: "Role-based access controls implemented",
      required: true,
    },
    {
      id: "audit_trail",
      category: "Data Integrity",
      item: "Audit trail maintained for all data changes",
      required: true,
    },
    {
      id: "consent_forms",
      category: "Privacy",
      item: "Client consent forms collected and stored",
      required: true,
    },
    {
      id: "staff_training",
      category: "Operations",
      item: "Staff compliance training completed",
      required: false,
    },
    {
      id: "incident_response",
      category: "Operations",
      item: "Incident response procedures documented",
      required: false,
    },
  ];
}

/**
 * Get recommended section order for compliance reports
 */
export function getComplianceSectionOrder(): string[] {
  return [
    "executive_summary",
    "program_overview",
    "demographics_analysis",
    "outcomes_analysis",
  ];
}

/**
 * Get audit period options
 */
export function getAuditPeriodOptions(): Array<{
  id: string;
  label: string;
  months: number;
}> {
  return [
    { id: "quarterly", label: "Quarterly (3 months)", months: 3 },
    { id: "semi_annual", label: "Semi-Annual (6 months)", months: 6 },
    { id: "annual", label: "Annual (12 months)", months: 12 },
    { id: "fiscal_year", label: "Fiscal Year", months: 12 },
  ];
}
