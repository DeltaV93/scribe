/**
 * AI Narrative Generation Service
 *
 * Generates contextual narrative sections for reports using Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ReportType } from "@prisma/client";
import { MetricResult } from "./aggregation";
import { PreBuiltMetric } from "./pre-built-metrics";

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

export type NarrativeSectionType =
  | "executive_summary"
  | "program_overview"
  | "demographics_analysis"
  | "outcomes_analysis"
  | "challenges_opportunities"
  | "future_goals"
  | "acknowledgments";

export interface NarrativeContext {
  organizationName: string;
  reportType: ReportType;
  reportingPeriod: {
    start: Date;
    end: Date;
  };
  metrics: Array<{
    metric: PreBuiltMetric;
    result: MetricResult;
    previousPeriodResult?: MetricResult;
  }>;
  programNames?: string[];
  questionnaireAnswers?: Record<string, unknown>;
  existingNarratives?: Record<NarrativeSectionType, string>;
}

export interface NarrativeSection {
  type: NarrativeSectionType;
  title: string;
  content: string;
  wordCount: number;
}

export interface GenerateNarrativeOptions {
  sectionTypes: NarrativeSectionType[];
  tone?: "formal" | "conversational" | "compelling";
  maxWordsPerSection?: number;
  includeDataCitations?: boolean;
  anonymizeClientData?: boolean;
}

/**
 * Generate narrative sections for a report
 */
export async function generateNarratives(
  context: NarrativeContext,
  options: GenerateNarrativeOptions
): Promise<NarrativeSection[]> {
  const narratives: NarrativeSection[] = [];

  for (const sectionType of options.sectionTypes) {
    const narrative = await generateSingleNarrative(context, sectionType, options);
    narratives.push(narrative);
  }

  return narratives;
}

/**
 * Generate a single narrative section
 */
async function generateSingleNarrative(
  context: NarrativeContext,
  sectionType: NarrativeSectionType,
  options: GenerateNarrativeOptions
): Promise<NarrativeSection> {
  const prompt = buildNarrativePrompt(context, sectionType, options);

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from AI");
  }

  const narrativeContent = content.text.trim();
  const wordCount = narrativeContent.split(/\s+/).length;

  return {
    type: sectionType,
    title: getSectionTitle(sectionType),
    content: narrativeContent,
    wordCount,
  };
}

function buildNarrativePrompt(
  context: NarrativeContext,
  sectionType: NarrativeSectionType,
  options: GenerateNarrativeOptions
): string {
  const { organizationName, reportType, reportingPeriod, metrics } = context;

  // Format the reporting period
  const periodStart = reportingPeriod.start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const periodEnd = reportingPeriod.end.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Format metrics data
  const metricsText = metrics
    .map((m) => {
      let text = `- ${m.metric.name}: ${m.result.formattedValue}`;
      if (m.previousPeriodResult) {
        const change = m.result.value - m.previousPeriodResult.value;
        const changeDirection = change >= 0 ? "up" : "down";
        text += ` (${changeDirection} from ${m.previousPeriodResult.formattedValue})`;
      }
      if (m.result.benchmarkStatus) {
        text += ` [${m.result.benchmarkStatus} performance]`;
      }
      return text;
    })
    .join("\n");

  // Define tone
  const toneInstructions = {
    formal: "Use formal, professional language appropriate for official reports and compliance documents.",
    conversational: "Use accessible, friendly language while maintaining professionalism.",
    compelling: "Use engaging, story-driven language that highlights impact and inspires action.",
  };

  const tone = options.tone || "formal";

  // Section-specific instructions
  const sectionInstructions = getSectionInstructions(sectionType, context);

  return `You are an expert grant writer and nonprofit communications specialist. Generate a ${getSectionTitle(sectionType).toLowerCase()} section for a ${getReportTypeLabel(reportType)} report.

ORGANIZATION: ${organizationName}
REPORTING PERIOD: ${periodStart} to ${periodEnd}

KEY METRICS:
${metricsText}

${context.programNames && context.programNames.length > 0 ? `PROGRAMS: ${context.programNames.join(", ")}` : ""}

WRITING GUIDELINES:
- ${toneInstructions[tone]}
- Maximum ${options.maxWordsPerSection || 300} words
${options.includeDataCitations ? "- Cite specific data points to support claims" : ""}
${options.anonymizeClientData ? "- Do not include any identifying client information" : ""}

SECTION-SPECIFIC INSTRUCTIONS:
${sectionInstructions}

Write the narrative section now. Do not include any headers or titles - just the content.`;
}

function getSectionTitle(sectionType: NarrativeSectionType): string {
  const titles: Record<NarrativeSectionType, string> = {
    executive_summary: "Executive Summary",
    program_overview: "Program Overview",
    demographics_analysis: "Demographics Analysis",
    outcomes_analysis: "Outcomes Analysis",
    challenges_opportunities: "Challenges and Opportunities",
    future_goals: "Future Goals",
    acknowledgments: "Acknowledgments",
  };
  return titles[sectionType];
}

function getSectionInstructions(
  sectionType: NarrativeSectionType,
  context: NarrativeContext
): string {
  const instructions: Record<NarrativeSectionType, string> = {
    executive_summary: `
Write a concise executive summary that:
- Highlights the most significant achievements during this reporting period
- Mentions key metrics and outcomes
- Provides context for stakeholders who may only read this section
- Ends with a forward-looking statement`,

    program_overview: `
Describe the programs and services provided:
- Explain the core services offered
- Describe the target population served
- Highlight any program expansions or changes during this period
- Connect services to outcomes achieved`,

    demographics_analysis: `
Analyze the demographics of the population served:
- Describe the characteristics of clients served
- Note any trends or changes in the population
- Highlight any underserved populations reached
- Connect demographics to service design decisions`,

    outcomes_analysis: `
Analyze the outcomes achieved:
- Highlight the most significant outcome metrics
- Compare to previous periods or benchmarks when available
- Explain the factors contributing to outcomes
- Address any areas needing improvement`,

    challenges_opportunities: `
Discuss challenges faced and opportunities identified:
- Be honest about obstacles encountered
- Describe how challenges were addressed
- Identify opportunities for improvement
- Connect to future planning`,

    future_goals: `
Outline future goals and plans:
- Set specific goals for the next reporting period
- Connect goals to current performance
- Describe planned improvements or expansions
- Show alignment with funder priorities`,

    acknowledgments: `
Write brief acknowledgments:
- Thank key funders and supporters
- Recognize staff and volunteers
- Acknowledge community partners
- Keep it professional but warm`,
  };

  return instructions[sectionType];
}

function getReportTypeLabel(reportType: ReportType): string {
  const labels: Record<ReportType, string> = {
    HUD_APR: "HUD Annual Performance Report",
    DOL_WORKFORCE: "DOL Workforce Performance",
    CALI_GRANTS: "California Grant",
    BOARD_REPORT: "Board",
    IMPACT_REPORT: "Impact",
    CUSTOM: "Custom",
  };
  return labels[reportType];
}

/**
 * Regenerate a single narrative section with custom instructions
 */
export async function regenerateNarrative(
  context: NarrativeContext,
  sectionType: NarrativeSectionType,
  customInstructions: string,
  options: GenerateNarrativeOptions
): Promise<NarrativeSection> {
  const basePrompt = buildNarrativePrompt(context, sectionType, options);

  const enhancedPrompt = `${basePrompt}

ADDITIONAL INSTRUCTIONS FROM USER:
${customInstructions}`;

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: enhancedPrompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from AI");
  }

  const narrativeContent = content.text.trim();
  const wordCount = narrativeContent.split(/\s+/).length;

  return {
    type: sectionType,
    title: getSectionTitle(sectionType),
    content: narrativeContent,
    wordCount,
  };
}

/**
 * Get default sections for a report type
 */
export function getDefaultSections(reportType: ReportType): NarrativeSectionType[] {
  const sectionsByType: Record<ReportType, NarrativeSectionType[]> = {
    HUD_APR: [
      "executive_summary",
      "program_overview",
      "demographics_analysis",
      "outcomes_analysis",
    ],
    DOL_WORKFORCE: [
      "executive_summary",
      "program_overview",
      "outcomes_analysis",
      "challenges_opportunities",
    ],
    CALI_GRANTS: [
      "executive_summary",
      "program_overview",
      "outcomes_analysis",
      "future_goals",
    ],
    BOARD_REPORT: [
      "executive_summary",
      "program_overview",
      "outcomes_analysis",
      "challenges_opportunities",
      "future_goals",
    ],
    IMPACT_REPORT: [
      "executive_summary",
      "program_overview",
      "demographics_analysis",
      "outcomes_analysis",
      "future_goals",
      "acknowledgments",
    ],
    CUSTOM: ["executive_summary", "outcomes_analysis"],
  };

  return sectionsByType[reportType];
}

/**
 * Get all available narrative section types
 */
export function getAvailableSectionTypes(): Array<{
  type: NarrativeSectionType;
  title: string;
  description: string;
}> {
  return [
    {
      type: "executive_summary",
      title: "Executive Summary",
      description: "High-level overview of key achievements and outcomes",
    },
    {
      type: "program_overview",
      title: "Program Overview",
      description: "Description of programs and services provided",
    },
    {
      type: "demographics_analysis",
      title: "Demographics Analysis",
      description: "Analysis of the population served",
    },
    {
      type: "outcomes_analysis",
      title: "Outcomes Analysis",
      description: "Detailed analysis of program outcomes",
    },
    {
      type: "challenges_opportunities",
      title: "Challenges & Opportunities",
      description: "Discussion of challenges faced and opportunities identified",
    },
    {
      type: "future_goals",
      title: "Future Goals",
      description: "Plans and goals for the next reporting period",
    },
    {
      type: "acknowledgments",
      title: "Acknowledgments",
      description: "Recognition of funders, staff, and partners",
    },
  ];
}
