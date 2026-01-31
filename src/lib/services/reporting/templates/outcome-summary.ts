/**
 * Outcome Summary Report Template
 *
 * Template for client outcomes and program effectiveness reports.
 */

import { FunderTemplateDefinition } from "../types";

export const outcomeSummaryTemplate: FunderTemplateDefinition = {
  id: "outcome-summary",
  name: "Client Outcomes Summary",
  funderName: "General",
  reportType: "IMPACT_REPORT",
  description:
    "Comprehensive summary of client outcomes including program completion rates, goal achievement, and long-term impact metrics.",
  version: "1.0",

  requiredMetrics: [
    "general_clients_served",
    "general_program_completions",
    "general_completion_rate",
  ],

  requiredSections: ["executive_summary", "outcomes_analysis"],

  outputFormat: ["pdf", "excel"],

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
      field: "metrics",
      rule: "min",
      value: 3,
      message: "At least 3 metrics are required for outcome summary reports",
    },
  ],
};

/**
 * Get outcome-specific metric configurations
 */
export function getOutcomeMetricCategories(): Array<{
  category: string;
  label: string;
  metrics: string[];
}> {
  return [
    {
      category: "participation",
      label: "Participation Metrics",
      metrics: [
        "general_clients_served",
        "general_new_clients",
        "general_program_enrollments",
      ],
    },
    {
      category: "completion",
      label: "Completion Metrics",
      metrics: [
        "general_program_completions",
        "general_completion_rate",
        "general_attendance_rate",
      ],
    },
    {
      category: "outcomes",
      label: "Outcome Metrics",
      metrics: [
        "hud_exits_to_permanent_housing",
        "hud_permanent_housing_rate",
        "hud_income_increase_at_exit",
      ],
    },
  ];
}

/**
 * Get recommended section order for outcome reports
 */
export function getOutcomeSectionOrder(): string[] {
  return [
    "executive_summary",
    "program_overview",
    "demographics_analysis",
    "outcomes_analysis",
    "challenges_opportunities",
    "future_goals",
    "acknowledgments",
  ];
}
