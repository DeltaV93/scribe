/**
 * Sensitivity Categories (PX-865)
 * Fixed universal categories for content classification
 */

import type { SensitivityCategory, SensitivityTier } from "@prisma/client";

/**
 * Category definitions with detection patterns and tier mapping
 */
export interface CategoryDefinition {
  category: SensitivityCategory;
  name: string;
  description: string;
  defaultTier: SensitivityTier;
  keywords: string[];
  patterns: RegExp[];
  examples: string[];
}

export const SENSITIVITY_CATEGORIES: CategoryDefinition[] = [
  {
    category: "PERSONAL_OFF_TOPIC",
    name: "Personal/Off-Topic",
    description: "Personal conversations, gossip, non-work discussions",
    defaultTier: "REDACTED",
    keywords: [
      "personal",
      "weekend",
      "vacation",
      "family",
      "dating",
      "relationship",
      "gossip",
      "drama",
      "party",
      "hangover",
      "drama",
      "boyfriend",
      "girlfriend",
      "ex",
      "divorce",
      "argument",
      "fight",
      "stress",
      "anxiety",
      "depressed",
      "upset",
      "frustrated",
      "angry",
    ],
    patterns: [
      /\b(my|his|her|their)\s+(personal|private)\s+(life|stuff|business)/i,
      /\b(don't tell|keep this between|just between us)/i,
      /\b(off the record|not for work|personal matter)/i,
    ],
    examples: [
      "I've been having trouble with my relationship lately...",
      "Did you hear about what happened at the party?",
      "My ex keeps texting me...",
    ],
  },
  {
    category: "HR_SENSITIVE",
    name: "HR Sensitive",
    description: "Personnel matters, layoffs, terminations, performance issues",
    defaultTier: "RESTRICTED",
    keywords: [
      "layoff",
      "layoffs",
      "fired",
      "firing",
      "terminated",
      "termination",
      "performance review",
      "pip",
      "performance improvement",
      "warning",
      "written up",
      "hr",
      "human resources",
      "complaint",
      "harassment",
      "discrimination",
      "promotion",
      "demotion",
      "restructuring",
      "downsizing",
      "severance",
      "compensation",
      "salary negotiation",
      "confidential hr",
    ],
    patterns: [
      /\b(considering|planning)\s+(to\s+)?(fire|terminate|let\s+go)/i,
      /\b(performance|conduct)\s+(issue|problem|concern)/i,
      /\b(confidential|sensitive)\s+hr\s+(matter|issue)/i,
      /\b(between\s+us|off\s+the\s+record).*(employee|staff|team\s+member)/i,
    ],
    examples: [
      "We're going to have to let John go...",
      "There's been a complaint about workplace behavior...",
      "The performance improvement plan isn't working...",
    ],
  },
  {
    category: "LEGAL_SENSITIVE",
    name: "Legal Sensitive",
    description: "Legal discussions, compliance issues, litigation",
    defaultTier: "RESTRICTED",
    keywords: [
      "lawyer",
      "attorney",
      "legal",
      "lawsuit",
      "litigation",
      "sue",
      "sued",
      "settlement",
      "contract dispute",
      "breach",
      "liability",
      "compliance",
      "violation",
      "regulatory",
      "investigation",
      "subpoena",
      "deposition",
      "court",
      "judge",
      "privilege",
      "attorney-client",
      "nda",
      "non-disclosure",
      "intellectual property",
      "patent",
      "trademark",
      "copyright",
    ],
    patterns: [
      /\b(attorney|lawyer).*(privilege|confidential)/i,
      /\b(potential|possible|pending)\s+(lawsuit|litigation)/i,
      /\b(compliance|regulatory)\s+(issue|violation|concern)/i,
      /\b(legal\s+)?(investigation|inquiry)/i,
    ],
    examples: [
      "Our lawyers are reviewing the contract...",
      "We might have a compliance issue here...",
      "The investigation is still ongoing...",
    ],
  },
  {
    category: "HEALTH_SENSITIVE",
    name: "Health Sensitive",
    description: "Medical information, health conditions, PHI",
    defaultTier: "RESTRICTED",
    keywords: [
      "diagnosis",
      "treatment",
      "medication",
      "prescription",
      "doctor",
      "hospital",
      "surgery",
      "medical",
      "health",
      "condition",
      "illness",
      "disease",
      "cancer",
      "therapy",
      "mental health",
      "psychiatric",
      "addiction",
      "rehab",
      "disability",
      "pregnant",
      "pregnancy",
      "symptoms",
      "chronic",
      "patient",
      "hipaa",
      "phi",
    ],
    patterns: [
      /\b(diagnosed|treating|treated)\s+(with|for)/i,
      /\b(medical|health)\s+(condition|issue|problem|history)/i,
      /\b(taking|prescribed)\s+(medication|medicine)/i,
      /\b(seeing\s+a|going\s+to)\s+(doctor|therapist|specialist)/i,
    ],
    examples: [
      "I was just diagnosed with...",
      "The client has a medical condition that...",
      "She's been going through cancer treatment...",
    ],
  },
  {
    category: "FINANCIAL_SENSITIVE",
    name: "Financial Sensitive",
    description: "Financial projections, M&A, salary, confidential business data",
    defaultTier: "RESTRICTED",
    keywords: [
      "salary",
      "compensation",
      "bonus",
      "equity",
      "stock",
      "options",
      "valuation",
      "revenue",
      "profit",
      "loss",
      "budget",
      "forecast",
      "projection",
      "acquisition",
      "merger",
      "ipo",
      "funding",
      "investment",
      "investor",
      "board",
      "financial",
      "confidential numbers",
      "burn rate",
      "runway",
      "cap table",
    ],
    patterns: [
      /\b(acquisition|merger)\s+(target|talks|discussions)/i,
      /\b(confidential|internal)\s+(financial|revenue|budget)/i,
      /\b(investor|board)\s+(meeting|presentation|update)/i,
      /\$[\d,]+\s*(million|billion|k|m|b)/i,
    ],
    examples: [
      "The acquisition talks are progressing...",
      "Our projected revenue for Q4 is...",
      "The board doesn't know about this yet...",
    ],
  },
];

/**
 * Get category definition by category enum
 */
export function getCategoryDefinition(
  category: SensitivityCategory
): CategoryDefinition | undefined {
  return SENSITIVITY_CATEGORIES.find((c) => c.category === category);
}

/**
 * Get all keywords across all categories for quick detection
 */
export function getAllKeywords(): Map<string, SensitivityCategory> {
  const keywordMap = new Map<string, SensitivityCategory>();

  for (const categoryDef of SENSITIVITY_CATEGORIES) {
    for (const keyword of categoryDef.keywords) {
      keywordMap.set(keyword.toLowerCase(), categoryDef.category);
    }
  }

  return keywordMap;
}

/**
 * Tier descriptions for user-facing UI
 */
export const TIER_DESCRIPTIONS: Record<SensitivityTier, { name: string; description: string }> = {
  REDACTED: {
    name: "Redact",
    description: "Content will be permanently removed from the record",
  },
  RESTRICTED: {
    name: "Restricted",
    description: "Content visible only to meeting participants and granted users",
  },
  STANDARD: {
    name: "Standard",
    description: "Normal processing, no access restrictions",
  },
};

/**
 * Category descriptions for user-facing UI
 */
export const CATEGORY_DESCRIPTIONS: Record<SensitivityCategory, string> = {
  PERSONAL_OFF_TOPIC: "Personal conversations and non-work discussions",
  HR_SENSITIVE: "HR matters, personnel decisions, and workplace issues",
  LEGAL_SENSITIVE: "Legal discussions, compliance, and litigation",
  HEALTH_SENSITIVE: "Medical information and health-related content",
  FINANCIAL_SENSITIVE: "Financial data, M&A, and confidential business information",
};
