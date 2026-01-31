/**
 * AI Metric Suggestion Service
 *
 * Uses Claude to suggest relevant metrics based on questionnaire answers
 * and funder requirements.
 */

import { ReportType } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { getMetricsForReportType, PreBuiltMetric, ALL_METRICS } from "./pre-built-metrics";

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

export interface MetricSuggestion {
  metricId: string;
  metric: PreBuiltMetric;
  relevanceScore: number; // 0-1 indicating how relevant this metric is
  reason: string; // Explanation of why this metric is suggested
  priority: "required" | "recommended" | "optional";
  customizations?: {
    suggestedName?: string;
    suggestedFilters?: Array<{ field: string; value: unknown }>;
  };
}

export interface SuggestMetricsInput {
  reportType: ReportType;
  questionnaireAnswers: Record<string, unknown>;
  funderRequirements?: string; // Extracted text from funder documents
  existingMetricIds?: string[]; // Already selected metrics to avoid duplicates
}

export interface SuggestMetricsResult {
  suggestions: MetricSuggestion[];
  customMetricSuggestions?: Array<{
    name: string;
    description: string;
    reason: string;
  }>;
}

/**
 * Get AI-powered metric suggestions based on questionnaire answers
 */
export async function suggestMetrics(input: SuggestMetricsInput): Promise<SuggestMetricsResult> {
  const { reportType, questionnaireAnswers, funderRequirements, existingMetricIds = [] } = input;

  // Get available metrics for this report type
  const availableMetrics = getMetricsForReportType(reportType).filter(
    (m) => !existingMetricIds.includes(m.id)
  );

  // Build the prompt for Claude
  const prompt = buildSuggestionPrompt(reportType, questionnaireAnswers, availableMetrics, funderRequirements);

  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Parse the response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response format from AI");
  }

  return parseSuggestionResponse(content.text, availableMetrics);
}

function buildSuggestionPrompt(
  reportType: ReportType,
  answers: Record<string, unknown>,
  availableMetrics: PreBuiltMetric[],
  funderRequirements?: string
): string {
  const metricsDescription = availableMetrics
    .map((m) => `- ${m.id}: ${m.name} - ${m.description} (Category: ${m.category})`)
    .join("\n");

  const answersText = Object.entries(answers)
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join("\n");

  return `You are an expert in nonprofit and social services reporting. Based on the following information, suggest the most relevant metrics for this report.

REPORT TYPE: ${reportType}

QUESTIONNAIRE ANSWERS:
${answersText}

${funderRequirements ? `FUNDER REQUIREMENTS:\n${funderRequirements}\n` : ""}

AVAILABLE METRICS:
${metricsDescription}

Please analyze the questionnaire answers and provide metric suggestions in the following JSON format:

{
  "suggestions": [
    {
      "metricId": "the_metric_id",
      "relevanceScore": 0.95,
      "reason": "Brief explanation of why this metric is relevant",
      "priority": "required" | "recommended" | "optional"
    }
  ],
  "customMetricSuggestions": [
    {
      "name": "Suggested custom metric name",
      "description": "What this metric would measure",
      "reason": "Why this would be valuable"
    }
  ]
}

Guidelines:
1. Prioritize metrics that directly address funder requirements
2. Mark metrics as "required" if they're essential for compliance or the funder explicitly requires them
3. Mark metrics as "recommended" if they would strengthen the report or are commonly expected
4. Mark metrics as "optional" if they would add value but aren't critical
5. Only suggest custom metrics if there's a clear gap in the available metrics
6. Consider the program type and services indicated in the answers
7. Relevance score should reflect how well the metric matches the organization's needs

Respond ONLY with valid JSON, no additional text.`;
}

function parseSuggestionResponse(
  responseText: string,
  availableMetrics: PreBuiltMetric[]
): SuggestMetricsResult {
  // Extract JSON from response (in case there's any extra text)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback to rule-based suggestions if AI parsing fails
    return getRuleBasedSuggestions(availableMetrics);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestions?: Array<{
        metricId: string;
        relevanceScore: number;
        reason: string;
        priority: "required" | "recommended" | "optional";
      }>;
      customMetricSuggestions?: Array<{
        name: string;
        description: string;
        reason: string;
      }>;
    };

    const suggestions: MetricSuggestion[] = [];

    for (const suggestion of parsed.suggestions || []) {
      const metric = availableMetrics.find((m) => m.id === suggestion.metricId);
      if (metric) {
        suggestions.push({
          metricId: suggestion.metricId,
          metric,
          relevanceScore: Math.min(1, Math.max(0, suggestion.relevanceScore)),
          reason: suggestion.reason,
          priority: suggestion.priority,
        });
      }
    }

    // Sort by priority and relevance
    suggestions.sort((a, b) => {
      const priorityOrder = { required: 0, recommended: 1, optional: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.relevanceScore - a.relevanceScore;
    });

    return {
      suggestions,
      customMetricSuggestions: parsed.customMetricSuggestions,
    };
  } catch {
    // Fallback to rule-based suggestions if parsing fails
    return getRuleBasedSuggestions(availableMetrics);
  }
}

/**
 * Fallback rule-based suggestions when AI is unavailable
 */
function getRuleBasedSuggestions(availableMetrics: PreBuiltMetric[]): SuggestMetricsResult {
  const suggestions: MetricSuggestion[] = [];

  // Group metrics by category
  const byCategory = new Map<string, PreBuiltMetric[]>();
  for (const metric of availableMetrics) {
    const existing = byCategory.get(metric.category) || [];
    existing.push(metric);
    byCategory.set(metric.category, existing);
  }

  // Take top metrics from each category
  for (const [category, metrics] of byCategory) {
    const priority = category === "outcomes" ? "required" as const : "recommended" as const;

    // Take first 3 from each category
    for (const metric of metrics.slice(0, 3)) {
      suggestions.push({
        metricId: metric.id,
        metric,
        relevanceScore: 0.7,
        reason: `Standard ${category} metric for this report type`,
        priority,
      });
    }
  }

  return { suggestions };
}

/**
 * Search for metrics by keyword
 */
export function searchMetrics(query: string, reportType?: ReportType): PreBuiltMetric[] {
  const queryLower = query.toLowerCase();

  let metrics = ALL_METRICS;
  if (reportType) {
    metrics = metrics.filter((m) => m.reportTypes.includes(reportType));
  }

  return metrics.filter(
    (m) =>
      m.name.toLowerCase().includes(queryLower) ||
      m.description.toLowerCase().includes(queryLower) ||
      m.category.toLowerCase().includes(queryLower)
  );
}

/**
 * Get metric suggestions based on funder document
 */
export async function suggestMetricsFromDocument(
  documentText: string,
  reportType: ReportType
): Promise<SuggestMetricsResult> {
  return suggestMetrics({
    reportType,
    questionnaireAnswers: {},
    funderRequirements: documentText,
  });
}
