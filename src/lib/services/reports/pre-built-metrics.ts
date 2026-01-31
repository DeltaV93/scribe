/**
 * Pre-built Metrics Library
 *
 * Curated library of common metrics for various report types.
 * These can be cloned and customized by organizations.
 */

import { ReportType } from "@prisma/client";

export type MetricCategory = "demographics" | "services" | "outcomes" | "financial" | "operations";

export type AggregationType = "count" | "sum" | "average" | "percentage" | "median" | "min" | "max";

export type DataSource = "clients" | "enrollments" | "attendance" | "submissions" | "notes" | "calls";

export interface MetricFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "notIn" | "contains" | "between";
  value: unknown;
}

export interface MetricCalculation {
  dataSource: DataSource;
  aggregation: AggregationType;
  field?: string; // For sum/average operations
  filters?: MetricFilter[];
  groupBy?: string;
  // For percentage calculations
  numerator?: {
    dataSource: DataSource;
    aggregation: AggregationType;
    field?: string;
    filters?: MetricFilter[];
  };
  denominator?: {
    dataSource: DataSource;
    aggregation: AggregationType;
    field?: string;
    filters?: MetricFilter[];
  };
}

export interface PreBuiltMetric {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  reportTypes: ReportType[];
  calculation: MetricCalculation;
  displayFormat: "number" | "percentage" | "currency" | "duration";
  benchmark?: {
    good: number;
    excellent: number;
  };
  hudQuestion?: string; // Q number for HUD APR mapping
}

// HUD APR Pre-built Metrics
const HUD_APR_METRICS: PreBuiltMetric[] = [
  // Demographics
  {
    id: "hud_total_persons_served",
    name: "Total Persons Served",
    description: "Total number of unduplicated persons served during the reporting period",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "status", operator: "in", value: ["ACTIVE", "CLOSED"] },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q5a",
  },
  {
    id: "hud_total_households_served",
    name: "Total Households Served",
    description: "Total number of unduplicated households served",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      groupBy: "householdId",
    },
    displayFormat: "number",
    hudQuestion: "Q5a",
  },
  {
    id: "hud_adults_served",
    name: "Adults Served",
    description: "Number of adults (18+) served",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "ageAtEntry", operator: "gte", value: 18 },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q5a",
  },
  {
    id: "hud_children_served",
    name: "Children Served",
    description: "Number of children (under 18) served",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "ageAtEntry", operator: "lt", value: 18 },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q5a",
  },
  {
    id: "hud_veterans_served",
    name: "Veterans Served",
    description: "Number of veterans served",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "veteranStatus", operator: "eq", value: "YES" },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q12",
  },
  {
    id: "hud_chronically_homeless",
    name: "Chronically Homeless at Entry",
    description: "Number of persons who were chronically homeless at project entry",
    category: "demographics",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "chronicHomelessStatus", operator: "eq", value: true },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q26",
  },

  // Outcomes
  {
    id: "hud_exits_to_permanent_housing",
    name: "Exits to Permanent Housing",
    description: "Number of persons who exited to permanent housing destinations",
    category: "outcomes",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "exitDestination", operator: "in", value: ["rental_permanent", "owned", "family_permanent", "friends_permanent"] },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q23",
    benchmark: {
      good: 40,
      excellent: 60,
    },
  },
  {
    id: "hud_permanent_housing_rate",
    name: "Permanent Housing Exit Rate",
    description: "Percentage of leavers who exited to permanent housing",
    category: "outcomes",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDestination", operator: "in", value: ["rental_permanent", "owned", "family_permanent", "friends_permanent"] },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDate", operator: "neq", value: null },
        ],
      },
    },
    displayFormat: "percentage",
    hudQuestion: "Q23",
    benchmark: {
      good: 40,
      excellent: 65,
    },
  },
  {
    id: "hud_income_increase_at_exit",
    name: "Income Increase at Exit",
    description: "Percentage of adult leavers who increased income between entry and exit",
    category: "outcomes",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "incomeChangedAtExit", operator: "eq", value: "increased" },
          { field: "ageAtEntry", operator: "gte", value: 18 },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDate", operator: "neq", value: null },
          { field: "ageAtEntry", operator: "gte", value: 18 },
        ],
      },
    },
    displayFormat: "percentage",
    hudQuestion: "Q19",
    benchmark: {
      good: 30,
      excellent: 50,
    },
  },
  {
    id: "hud_average_length_of_stay",
    name: "Average Length of Stay",
    description: "Average number of days in project for leavers",
    category: "outcomes",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "average",
      field: "lengthOfStayDays",
      filters: [
        { field: "exitDate", operator: "neq", value: null },
      ],
    },
    displayFormat: "number",
    hudQuestion: "Q22",
  },
  {
    id: "hud_returns_to_homelessness",
    name: "Returns to Homelessness",
    description: "Percentage of persons who returned to homelessness within 2 years",
    category: "outcomes",
    reportTypes: ["HUD_APR"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "returnedToHomelessness", operator: "eq", value: true },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDestination", operator: "in", value: ["rental_permanent", "owned", "family_permanent", "friends_permanent"] },
        ],
      },
    },
    displayFormat: "percentage",
    hudQuestion: "Q25",
    benchmark: {
      good: 15,
      excellent: 8,
    },
  },
];

// DOL Workforce Metrics
const DOL_WORKFORCE_METRICS: PreBuiltMetric[] = [
  {
    id: "dol_total_participants",
    name: "Total Participants",
    description: "Total number of participants served during the reporting period",
    category: "demographics",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "enrollments",
      aggregation: "count",
    },
    displayFormat: "number",
  },
  {
    id: "dol_employment_q2",
    name: "Employment Rate Q2 After Exit",
    description: "Percentage employed in the 2nd quarter after exit",
    category: "outcomes",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "employedQ2AfterExit", operator: "eq", value: true },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDate", operator: "neq", value: null },
        ],
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 65,
      excellent: 80,
    },
  },
  {
    id: "dol_employment_q4",
    name: "Employment Rate Q4 After Exit",
    description: "Percentage employed in the 4th quarter after exit",
    category: "outcomes",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "employedQ4AfterExit", operator: "eq", value: true },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDate", operator: "neq", value: null },
        ],
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 60,
      excellent: 75,
    },
  },
  {
    id: "dol_median_earnings",
    name: "Median Earnings Q2",
    description: "Median earnings in the 2nd quarter after exit",
    category: "outcomes",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "clients",
      aggregation: "median",
      field: "earningsQ2AfterExit",
      filters: [
        { field: "employedQ2AfterExit", operator: "eq", value: true },
      ],
    },
    displayFormat: "currency",
    benchmark: {
      good: 6000,
      excellent: 8000,
    },
  },
  {
    id: "dol_credential_attainment",
    name: "Credential Attainment Rate",
    description: "Percentage who attained recognized credential during or after program",
    category: "outcomes",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "clients",
      aggregation: "percentage",
      numerator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "attainedCredential", operator: "eq", value: true },
        ],
      },
      denominator: {
        dataSource: "clients",
        aggregation: "count",
        filters: [
          { field: "exitDate", operator: "neq", value: null },
        ],
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 50,
      excellent: 70,
    },
  },
  {
    id: "dol_measurable_skill_gains",
    name: "Measurable Skill Gains Rate",
    description: "Percentage achieving measurable skill gains during program",
    category: "outcomes",
    reportTypes: ["DOL_WORKFORCE"],
    calculation: {
      dataSource: "enrollments",
      aggregation: "percentage",
      numerator: {
        dataSource: "enrollments",
        aggregation: "count",
        filters: [
          { field: "achievedSkillGain", operator: "eq", value: true },
        ],
      },
      denominator: {
        dataSource: "enrollments",
        aggregation: "count",
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 40,
      excellent: 60,
    },
  },
];

// General Impact Metrics (applicable to multiple report types)
const GENERAL_METRICS: PreBuiltMetric[] = [
  {
    id: "general_clients_served",
    name: "Total Clients Served",
    description: "Unduplicated count of clients served during the reporting period",
    category: "services",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
    },
    displayFormat: "number",
  },
  {
    id: "general_new_clients",
    name: "New Clients",
    description: "Number of new clients enrolled during the reporting period",
    category: "services",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "clients",
      aggregation: "count",
      filters: [
        { field: "createdAt", operator: "between", value: ["{{periodStart}}", "{{periodEnd}}"] },
      ],
    },
    displayFormat: "number",
  },
  {
    id: "general_program_enrollments",
    name: "Program Enrollments",
    description: "Total number of program enrollments",
    category: "services",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "enrollments",
      aggregation: "count",
    },
    displayFormat: "number",
  },
  {
    id: "general_program_completions",
    name: "Program Completions",
    description: "Number of participants who completed their program",
    category: "outcomes",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "enrollments",
      aggregation: "count",
      filters: [
        { field: "status", operator: "eq", value: "COMPLETED" },
      ],
    },
    displayFormat: "number",
  },
  {
    id: "general_completion_rate",
    name: "Program Completion Rate",
    description: "Percentage of enrolled participants who completed the program",
    category: "outcomes",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "enrollments",
      aggregation: "percentage",
      numerator: {
        dataSource: "enrollments",
        aggregation: "count",
        filters: [
          { field: "status", operator: "eq", value: "COMPLETED" },
        ],
      },
      denominator: {
        dataSource: "enrollments",
        aggregation: "count",
        filters: [
          { field: "status", operator: "in", value: ["COMPLETED", "WITHDRAWN", "FAILED"] },
        ],
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 60,
      excellent: 80,
    },
  },
  {
    id: "general_attendance_rate",
    name: "Average Attendance Rate",
    description: "Average attendance rate across all sessions",
    category: "operations",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "attendance",
      aggregation: "percentage",
      numerator: {
        dataSource: "attendance",
        aggregation: "count",
        filters: [
          { field: "attendanceType", operator: "eq", value: "PRESENT" },
        ],
      },
      denominator: {
        dataSource: "attendance",
        aggregation: "count",
      },
    },
    displayFormat: "percentage",
    benchmark: {
      good: 75,
      excellent: 90,
    },
  },
  {
    id: "general_total_hours",
    name: "Total Service Hours",
    description: "Total hours of services provided",
    category: "services",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "attendance",
      aggregation: "sum",
      field: "hoursAttended",
    },
    displayFormat: "number",
  },
  {
    id: "general_services_per_client",
    name: "Average Services Per Client",
    description: "Average number of service encounters per client",
    category: "services",
    reportTypes: ["BOARD_REPORT", "IMPACT_REPORT", "CUSTOM"],
    calculation: {
      dataSource: "attendance",
      aggregation: "average",
      groupBy: "clientId",
    },
    displayFormat: "number",
  },
];

// Export all metrics
export const ALL_METRICS: PreBuiltMetric[] = [
  ...HUD_APR_METRICS,
  ...DOL_WORKFORCE_METRICS,
  ...GENERAL_METRICS,
];

/**
 * Get all metrics for a specific report type
 */
export function getMetricsForReportType(reportType: ReportType): PreBuiltMetric[] {
  return ALL_METRICS.filter((metric) => metric.reportTypes.includes(reportType));
}

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: MetricCategory): PreBuiltMetric[] {
  return ALL_METRICS.filter((metric) => metric.category === category);
}

/**
 * Get a specific metric by ID
 */
export function getMetricById(metricId: string): PreBuiltMetric | undefined {
  return ALL_METRICS.find((metric) => metric.id === metricId);
}

/**
 * Get all HUD APR metrics organized by question number
 */
export function getHudMetricsByQuestion(): Map<string, PreBuiltMetric[]> {
  const map = new Map<string, PreBuiltMetric[]>();

  for (const metric of HUD_APR_METRICS) {
    if (metric.hudQuestion) {
      const existing = map.get(metric.hudQuestion) || [];
      existing.push(metric);
      map.set(metric.hudQuestion, existing);
    }
  }

  return map;
}

/**
 * Get all available categories
 */
export function getCategories(): Array<{ id: MetricCategory; label: string; description: string }> {
  return [
    {
      id: "demographics",
      label: "Demographics",
      description: "Client demographic data and characteristics",
    },
    {
      id: "services",
      label: "Services",
      description: "Service delivery and utilization metrics",
    },
    {
      id: "outcomes",
      label: "Outcomes",
      description: "Program outcomes and success metrics",
    },
    {
      id: "financial",
      label: "Financial",
      description: "Financial and cost-related metrics",
    },
    {
      id: "operations",
      label: "Operations",
      description: "Operational efficiency metrics",
    },
  ];
}
