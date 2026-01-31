/**
 * Report Questionnaire Service
 *
 * Handles guided questionnaire flow for report template creation.
 * Provides base questions plus type-specific questions.
 */

import { ReportType } from "@prisma/client";

// Question types for the questionnaire
export type QuestionType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "date" | "number";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  helpText?: string;
  options?: QuestionOption[];
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  dependsOn?: {
    questionId: string;
    value: string | string[] | boolean;
  };
}

export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface Questionnaire {
  reportType: ReportType;
  title: string;
  description: string;
  sections: QuestionSection[];
}

// Base questions applicable to all report types
const BASE_QUESTIONS: QuestionSection = {
  id: "base",
  title: "Basic Information",
  description: "General information about your report",
  questions: [
    {
      id: "report_name",
      text: "What would you like to name this report template?",
      type: "text",
      required: true,
      placeholder: "e.g., Q4 2024 HUD APR Report",
    },
    {
      id: "report_description",
      text: "Describe the purpose of this report",
      type: "textarea",
      required: false,
      placeholder: "Optional description for your records",
    },
    {
      id: "primary_funder",
      text: "Who is the primary funder for this report?",
      type: "text",
      required: true,
      placeholder: "e.g., HUD, Department of Labor",
    },
    {
      id: "reporting_frequency",
      text: "How often is this report required?",
      type: "select",
      required: true,
      options: [
        { value: "annual", label: "Annual" },
        { value: "semi_annual", label: "Semi-Annual" },
        { value: "quarterly", label: "Quarterly" },
        { value: "monthly", label: "Monthly" },
        { value: "one_time", label: "One-Time" },
      ],
    },
    {
      id: "include_narratives",
      text: "Would you like AI-generated narrative sections?",
      type: "boolean",
      required: true,
      helpText: "AI can generate contextual narratives based on your data",
    },
  ],
};

// HUD APR specific questions
const HUD_APR_QUESTIONS: QuestionSection[] = [
  {
    id: "hud_program",
    title: "Program Information",
    description: "Tell us about your HUD-funded program",
    questions: [
      {
        id: "coc_number",
        text: "What is your Continuum of Care (CoC) number?",
        type: "text",
        required: true,
        placeholder: "e.g., CA-501",
      },
      {
        id: "grant_number",
        text: "What is your grant number?",
        type: "text",
        required: true,
        placeholder: "e.g., CA0001L3T001808",
      },
      {
        id: "project_type",
        text: "What type of project is this?",
        type: "select",
        required: true,
        options: [
          { value: "es", label: "Emergency Shelter (ES)" },
          { value: "sh", label: "Safe Haven (SH)" },
          { value: "th", label: "Transitional Housing (TH)" },
          { value: "psh", label: "Permanent Supportive Housing (PSH)" },
          { value: "rrh", label: "Rapid Re-Housing (RRH)" },
          { value: "sso", label: "Street Outreach (SSO)" },
          { value: "hp", label: "Homelessness Prevention (HP)" },
          { value: "ce", label: "Coordinated Entry (CE)" },
          { value: "joint_th_rrh", label: "Joint TH/RRH" },
        ],
      },
      {
        id: "bed_inventory",
        text: "Total bed inventory for this project",
        type: "number",
        required: false,
        helpText: "Leave blank if not applicable",
        validation: { min: 0 },
      },
    ],
  },
  {
    id: "hud_demographics",
    title: "Demographics Reporting",
    description: "Configure how demographics are reported",
    questions: [
      {
        id: "track_chronic_homelessness",
        text: "Do you track chronic homelessness status?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_veteran_status",
        text: "Do you track veteran status?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_dv_status",
        text: "Do you track domestic violence survivor status?",
        type: "boolean",
        required: true,
      },
      {
        id: "demographic_fields",
        text: "Which additional demographics do you collect?",
        type: "multiselect",
        required: false,
        options: [
          { value: "disability_type", label: "Disability Type" },
          { value: "living_situation", label: "Prior Living Situation" },
          { value: "education", label: "Education Level" },
          { value: "employment", label: "Employment Status" },
          { value: "income_sources", label: "Income Sources" },
          { value: "non_cash_benefits", label: "Non-Cash Benefits" },
          { value: "health_insurance", label: "Health Insurance" },
        ],
      },
    ],
  },
  {
    id: "hud_outcomes",
    title: "Outcome Metrics",
    description: "Configure which outcome metrics to include",
    questions: [
      {
        id: "track_housing_outcomes",
        text: "Track housing placement outcomes?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_income_changes",
        text: "Track income changes at exit?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_returns_to_homelessness",
        text: "Track returns to homelessness (2-year lookback)?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_length_of_stay",
        text: "Track average length of stay?",
        type: "boolean",
        required: true,
      },
    ],
  },
];

// DOL Workforce specific questions
const DOL_WORKFORCE_QUESTIONS: QuestionSection[] = [
  {
    id: "dol_program",
    title: "Workforce Program Details",
    description: "Information about your workforce development program",
    questions: [
      {
        id: "program_type",
        text: "What type of workforce program is this?",
        type: "select",
        required: true,
        options: [
          { value: "wioa_adult", label: "WIOA Adult" },
          { value: "wioa_dislocated", label: "WIOA Dislocated Worker" },
          { value: "wioa_youth", label: "WIOA Youth" },
          { value: "wagner_peyser", label: "Wagner-Peyser" },
          { value: "youthbuild", label: "YouthBuild" },
          { value: "job_corps", label: "Job Corps" },
          { value: "apprenticeship", label: "Apprenticeship" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "grant_number",
        text: "Grant number or award number",
        type: "text",
        required: true,
      },
      {
        id: "performance_period_start",
        text: "Program performance period start",
        type: "date",
        required: true,
      },
      {
        id: "performance_period_end",
        text: "Program performance period end",
        type: "date",
        required: true,
      },
    ],
  },
  {
    id: "dol_outcomes",
    title: "Employment Outcomes",
    description: "Configure employment outcome tracking",
    questions: [
      {
        id: "track_employment_q2",
        text: "Track employment in Q2 after exit?",
        type: "boolean",
        required: true,
        helpText: "Primary indicator required by DOL",
      },
      {
        id: "track_employment_q4",
        text: "Track employment in Q4 after exit?",
        type: "boolean",
        required: true,
        helpText: "Primary indicator required by DOL",
      },
      {
        id: "track_median_earnings",
        text: "Track median earnings?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_credential_attainment",
        text: "Track credential attainment rate?",
        type: "boolean",
        required: true,
      },
      {
        id: "track_measurable_skill_gains",
        text: "Track measurable skill gains?",
        type: "boolean",
        required: true,
      },
    ],
  },
];

// Board/Impact report questions
const BOARD_IMPACT_QUESTIONS: QuestionSection[] = [
  {
    id: "audience",
    title: "Report Audience",
    description: "Who will be reading this report?",
    questions: [
      {
        id: "primary_audience",
        text: "Who is the primary audience?",
        type: "select",
        required: true,
        options: [
          { value: "board", label: "Board of Directors" },
          { value: "donors", label: "Major Donors" },
          { value: "public", label: "General Public" },
          { value: "staff", label: "Internal Staff" },
          { value: "funders", label: "Multiple Funders" },
        ],
      },
      {
        id: "report_style",
        text: "What style of report do you prefer?",
        type: "select",
        required: true,
        options: [
          { value: "data_heavy", label: "Data-heavy with detailed metrics" },
          { value: "narrative", label: "Story-focused with highlights" },
          { value: "balanced", label: "Balanced mix of data and narrative" },
          { value: "visual", label: "Visual/infographic style" },
        ],
      },
    ],
  },
  {
    id: "content_sections",
    title: "Report Content",
    description: "Select which sections to include",
    questions: [
      {
        id: "include_sections",
        text: "Which sections would you like to include?",
        type: "multiselect",
        required: true,
        options: [
          { value: "executive_summary", label: "Executive Summary" },
          { value: "mission_vision", label: "Mission & Vision Statement" },
          { value: "year_highlights", label: "Year/Period Highlights" },
          { value: "client_stories", label: "Client Success Stories" },
          { value: "service_metrics", label: "Service Delivery Metrics" },
          { value: "financial_overview", label: "Financial Overview" },
          { value: "staff_volunteers", label: "Staff & Volunteer Recognition" },
          { value: "partnerships", label: "Community Partnerships" },
          { value: "future_goals", label: "Future Goals & Initiatives" },
          { value: "acknowledgments", label: "Donor Acknowledgments" },
        ],
      },
      {
        id: "highlight_metrics",
        text: "Which key metrics should be highlighted?",
        type: "multiselect",
        required: true,
        options: [
          { value: "clients_served", label: "Total Clients Served" },
          { value: "services_delivered", label: "Services Delivered" },
          { value: "program_completion", label: "Program Completion Rate" },
          { value: "outcome_success", label: "Outcome Success Rate" },
          { value: "volunteer_hours", label: "Volunteer Hours" },
          { value: "cost_per_client", label: "Cost Per Client" },
          { value: "satisfaction_rate", label: "Client Satisfaction Rate" },
        ],
      },
    ],
  },
];

// Custom report questions
const CUSTOM_QUESTIONS: QuestionSection[] = [
  {
    id: "custom_setup",
    title: "Custom Report Setup",
    description: "Build your custom report from scratch",
    questions: [
      {
        id: "report_purpose",
        text: "What is the main purpose of this report?",
        type: "textarea",
        required: true,
        placeholder: "Describe what you're trying to demonstrate or report on",
      },
      {
        id: "data_focus",
        text: "What data should be the focus?",
        type: "multiselect",
        required: true,
        options: [
          { value: "client_demographics", label: "Client Demographics" },
          { value: "service_utilization", label: "Service Utilization" },
          { value: "program_outcomes", label: "Program Outcomes" },
          { value: "financial_data", label: "Financial Data" },
          { value: "staff_metrics", label: "Staff/Volunteer Metrics" },
          { value: "time_based_trends", label: "Time-Based Trends" },
        ],
      },
      {
        id: "comparison_needed",
        text: "Do you need period-over-period comparisons?",
        type: "boolean",
        required: true,
      },
      {
        id: "comparison_period",
        text: "Compare to which period?",
        type: "select",
        required: false,
        dependsOn: {
          questionId: "comparison_needed",
          value: true,
        },
        options: [
          { value: "previous_year", label: "Same period last year" },
          { value: "previous_quarter", label: "Previous quarter" },
          { value: "baseline", label: "Program baseline" },
        ],
      },
    ],
  },
];

/**
 * Get the questionnaire for a specific report type
 */
export function getQuestionnaire(reportType: ReportType): Questionnaire {
  const baseSection = BASE_QUESTIONS;
  let typeSpecificSections: QuestionSection[] = [];
  let title = "";
  let description = "";

  switch (reportType) {
    case "HUD_APR":
      typeSpecificSections = HUD_APR_QUESTIONS;
      title = "HUD Annual Performance Report (APR)";
      description = "Create a report template for HUD APR submission with all required metrics and data elements.";
      break;
    case "DOL_WORKFORCE":
      typeSpecificSections = DOL_WORKFORCE_QUESTIONS;
      title = "DOL Workforce Performance Report";
      description = "Create a report template for Department of Labor workforce program performance reporting.";
      break;
    case "CALI_GRANTS":
      // Use base questions plus custom questions for California grants
      typeSpecificSections = CUSTOM_QUESTIONS;
      title = "California Grant Report";
      description = "Create a report template for California state grant reporting requirements.";
      break;
    case "BOARD_REPORT":
      typeSpecificSections = BOARD_IMPACT_QUESTIONS;
      title = "Board Report";
      description = "Create a professional report template for your board of directors.";
      break;
    case "IMPACT_REPORT":
      typeSpecificSections = BOARD_IMPACT_QUESTIONS;
      title = "Impact Report";
      description = "Create a compelling impact report to showcase your organization's work.";
      break;
    case "CUSTOM":
    default:
      typeSpecificSections = CUSTOM_QUESTIONS;
      title = "Custom Report";
      description = "Build a custom report template tailored to your specific needs.";
      break;
  }

  return {
    reportType,
    title,
    description,
    sections: [baseSection, ...typeSpecificSections],
  };
}

/**
 * Validate questionnaire answers
 */
export interface ValidationError {
  questionId: string;
  message: string;
}

export function validateAnswers(
  questionnaire: Questionnaire,
  answers: Record<string, unknown>
): { isValid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      // Check dependency
      if (question.dependsOn) {
        const dependsOnValue = answers[question.dependsOn.questionId];
        const expectedValue = question.dependsOn.value;

        if (Array.isArray(expectedValue)) {
          if (!expectedValue.includes(dependsOnValue as string)) {
            continue; // Skip validation if dependency not met
          }
        } else if (dependsOnValue !== expectedValue) {
          continue; // Skip validation if dependency not met
        }
      }

      const answer = answers[question.id];

      // Check required
      if (question.required) {
        if (answer === undefined || answer === null || answer === "") {
          errors.push({
            questionId: question.id,
            message: `${question.text} is required`,
          });
          continue;
        }
        if (Array.isArray(answer) && answer.length === 0) {
          errors.push({
            questionId: question.id,
            message: `Please select at least one option for: ${question.text}`,
          });
          continue;
        }
      }

      // Check validation rules
      if (question.validation && answer !== undefined && answer !== null) {
        if (question.validation.min !== undefined && typeof answer === "number") {
          if (answer < question.validation.min) {
            errors.push({
              questionId: question.id,
              message: question.validation.message || `Value must be at least ${question.validation.min}`,
            });
          }
        }
        if (question.validation.max !== undefined && typeof answer === "number") {
          if (answer > question.validation.max) {
            errors.push({
              questionId: question.id,
              message: question.validation.message || `Value must be at most ${question.validation.max}`,
            });
          }
        }
        if (question.validation.pattern && typeof answer === "string") {
          const regex = new RegExp(question.validation.pattern);
          if (!regex.test(answer)) {
            errors.push({
              questionId: question.id,
              message: question.validation.message || "Invalid format",
            });
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get all available report types with descriptions
 */
export function getReportTypes(): Array<{
  type: ReportType;
  label: string;
  description: string;
}> {
  return [
    {
      type: "HUD_APR",
      label: "HUD Annual Performance Report (APR)",
      description: "Standard report for HUD-funded homelessness programs with required metrics and data elements.",
    },
    {
      type: "DOL_WORKFORCE",
      label: "DOL Workforce Report",
      description: "Performance reporting for Department of Labor workforce development programs.",
    },
    {
      type: "CALI_GRANTS",
      label: "California Grant Report",
      description: "Reporting template for California state-funded grant programs.",
    },
    {
      type: "BOARD_REPORT",
      label: "Board Report",
      description: "Professional report for board of directors with key metrics and highlights.",
    },
    {
      type: "IMPACT_REPORT",
      label: "Impact Report",
      description: "Compelling impact report showcasing your organization's outcomes and stories.",
    },
    {
      type: "CUSTOM",
      label: "Custom Report",
      description: "Build a fully customized report template for any purpose.",
    },
  ];
}
