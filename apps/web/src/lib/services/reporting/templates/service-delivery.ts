/**
 * Service Delivery Report Template
 *
 * Template for service delivery metrics and utilization reports.
 */

import { FunderTemplateDefinition } from "../types";

export const serviceDeliveryTemplate: FunderTemplateDefinition = {
  id: "service-delivery",
  name: "Service Delivery Report",
  funderName: "General",
  reportType: "BOARD_REPORT",
  description:
    "Detailed analysis of service delivery including hours provided, service utilization rates, and operational efficiency metrics.",
  version: "1.0",

  requiredMetrics: [
    "general_clients_served",
    "general_total_hours",
    "general_attendance_rate",
  ],

  requiredSections: ["executive_summary", "program_overview"],

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
  ],
};

/**
 * Get service delivery specific metric categories
 */
export function getServiceDeliveryMetricCategories(): Array<{
  category: string;
  label: string;
  metrics: string[];
}> {
  return [
    {
      category: "volume",
      label: "Service Volume",
      metrics: [
        "general_clients_served",
        "general_new_clients",
        "general_total_hours",
        "general_services_per_client",
      ],
    },
    {
      category: "utilization",
      label: "Utilization Metrics",
      metrics: [
        "general_program_enrollments",
        "general_attendance_rate",
      ],
    },
    {
      category: "efficiency",
      label: "Efficiency Metrics",
      metrics: [
        "general_completion_rate",
        "general_services_per_client",
      ],
    },
  ];
}

/**
 * Get service delivery key performance indicators
 */
export function getServiceDeliveryKPIs(): Array<{
  id: string;
  name: string;
  target: number;
  format: "number" | "percentage" | "hours";
}> {
  return [
    {
      id: "utilization_rate",
      name: "Service Utilization Rate",
      target: 85,
      format: "percentage",
    },
    {
      id: "avg_hours_per_client",
      name: "Average Hours Per Client",
      target: 20,
      format: "hours",
    },
    {
      id: "client_satisfaction",
      name: "Client Satisfaction Score",
      target: 90,
      format: "percentage",
    },
  ];
}

/**
 * Get recommended section order for service delivery reports
 */
export function getServiceDeliverySectionOrder(): string[] {
  return [
    "executive_summary",
    "program_overview",
    "demographics_analysis",
    "outcomes_analysis",
    "challenges_opportunities",
  ];
}
