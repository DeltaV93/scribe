/**
 * Content Moderation Service
 *
 * Provides content moderation for messages to ensure HIPAA compliance
 * and flag inappropriate or concerning content.
 */

// ============================================
// TYPES
// ============================================

export interface ModerationResult {
  isApproved: boolean;
  flags: ModerationFlag[];
  severity: "none" | "low" | "medium" | "high" | "critical";
  reviewRequired: boolean;
  sanitizedContent?: string;
}

export interface ModerationFlag {
  type: ModerationFlagType;
  reason: string;
  snippet?: string;
  position?: { start: number; end: number };
}

export type ModerationFlagType =
  | "PHI_DETECTED"
  | "PROFANITY"
  | "THREAT"
  | "SELF_HARM"
  | "SPAM"
  | "CONTACT_INFO"
  | "FINANCIAL_INFO"
  | "SUSPICIOUS_LINK"
  | "CRISIS_INDICATOR";

// ============================================
// PATTERNS
// ============================================

const PATTERNS = {
  // Social Security Numbers
  SSN: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,

  // Credit Card Numbers
  CREDIT_CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,

  // Bank Account Numbers (basic pattern)
  BANK_ACCOUNT: /\b\d{8,17}\b/g,

  // Phone numbers
  PHONE: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // URLs
  URL: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,

  // Medical record numbers (common formats)
  MRN: /\bMRN[:\s]?\d{6,12}\b/gi,

  // Date of birth patterns
  DOB: /\b(?:DOB|birth\s*date|born)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,

  // Profanity (basic list - should be expanded)
  PROFANITY: /\b(fuck|shit|damn|ass|bitch|bastard)\b/gi,

  // Threat indicators
  THREAT: /\b(kill|hurt|harm|attack|destroy|murder|shoot|stab|threat|threaten)\b/gi,

  // Self-harm indicators
  SELF_HARM: /\b(suicide|suicidal|kill myself|end my life|self[- ]harm|cutting myself|overdose)\b/gi,

  // Crisis indicators
  CRISIS: /\b(emergency|urgent|crisis|danger|unsafe|abuse|violence|assault)\b/gi,
};

// ============================================
// MODERATION FUNCTIONS
// ============================================

/**
 * Moderate message content for compliance and safety
 */
export async function moderateContent(
  content: string,
  options: {
    checkPHI?: boolean;
    checkProfanity?: boolean;
    checkThreats?: boolean;
    checkLinks?: boolean;
  } = {}
): Promise<ModerationResult> {
  const {
    checkPHI = true,
    checkProfanity = true,
    checkThreats = true,
    checkLinks = true,
  } = options;

  const flags: ModerationFlag[] = [];

  // Check for PHI
  if (checkPHI) {
    flags.push(...detectPHI(content));
  }

  // Check for profanity
  if (checkProfanity) {
    flags.push(...detectProfanity(content));
  }

  // Check for threats and concerning content
  if (checkThreats) {
    flags.push(...detectThreats(content));
    flags.push(...detectSelfHarm(content));
    flags.push(...detectCrisisIndicators(content));
  }

  // Check for suspicious links
  if (checkLinks) {
    flags.push(...detectSuspiciousLinks(content));
  }

  // Calculate severity
  const severity = calculateSeverity(flags);

  // Determine if review is required
  const reviewRequired =
    severity === "critical" ||
    severity === "high" ||
    flags.some((f) => f.type === "SELF_HARM" || f.type === "CRISIS_INDICATOR");

  // Determine if approved (allow low severity through)
  const isApproved = severity === "none" || severity === "low";

  return {
    isApproved,
    flags,
    severity,
    reviewRequired,
    sanitizedContent: isApproved ? content : sanitizeContent(content, flags),
  };
}

/**
 * Detect PHI in content
 */
function detectPHI(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  // Check SSN
  const ssnMatches = content.matchAll(PATTERNS.SSN);
  for (const match of ssnMatches) {
    flags.push({
      type: "PHI_DETECTED",
      reason: "Social Security Number detected",
      snippet: match[0].slice(0, 3) + "***",
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  // Check MRN
  const mrnMatches = content.matchAll(PATTERNS.MRN);
  for (const match of mrnMatches) {
    flags.push({
      type: "PHI_DETECTED",
      reason: "Medical Record Number detected",
      snippet: match[0].slice(0, 5) + "***",
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  // Check DOB
  const dobMatches = content.matchAll(PATTERNS.DOB);
  for (const match of dobMatches) {
    flags.push({
      type: "PHI_DETECTED",
      reason: "Date of Birth detected",
      snippet: "DOB: ***",
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect financial information
 */
function detectFinancialInfo(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  // Check credit cards
  const ccMatches = content.matchAll(PATTERNS.CREDIT_CARD);
  for (const match of ccMatches) {
    flags.push({
      type: "FINANCIAL_INFO",
      reason: "Credit card number detected",
      snippet: "****" + match[0].slice(-4),
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect contact information
 */
export function detectContactInfo(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  // Check phone numbers
  const phoneMatches = content.matchAll(PATTERNS.PHONE);
  for (const match of phoneMatches) {
    flags.push({
      type: "CONTACT_INFO",
      reason: "Phone number detected",
      snippet: "***-***-" + match[0].slice(-4),
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  // Check emails
  const emailMatches = content.matchAll(PATTERNS.EMAIL);
  for (const match of emailMatches) {
    flags.push({
      type: "CONTACT_INFO",
      reason: "Email address detected",
      snippet: match[0].slice(0, 3) + "***@***",
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect profanity
 */
function detectProfanity(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  const matches = content.matchAll(PATTERNS.PROFANITY);
  for (const match of matches) {
    flags.push({
      type: "PROFANITY",
      reason: "Profane language detected",
      snippet: match[0][0] + "***",
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect threats
 */
function detectThreats(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];
  const lowerContent = content.toLowerCase();

  // Check for threat patterns with context
  const threatPatterns = [
    /i('m| am| will) (going to |gonna )?(kill|hurt|harm)/gi,
    /threat(en|ening)?/gi,
    /you('re| are) (going to |gonna )?die/gi,
  ];

  for (const pattern of threatPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      flags.push({
        type: "THREAT",
        reason: "Potential threat detected",
        snippet: match[0],
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  return flags;
}

/**
 * Detect self-harm indicators
 */
function detectSelfHarm(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  const matches = content.matchAll(PATTERNS.SELF_HARM);
  for (const match of matches) {
    flags.push({
      type: "SELF_HARM",
      reason: "Self-harm indicator detected - immediate review required",
      snippet: match[0],
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect crisis indicators
 */
function detectCrisisIndicators(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  const matches = content.matchAll(PATTERNS.CRISIS);
  for (const match of matches) {
    flags.push({
      type: "CRISIS_INDICATOR",
      reason: "Crisis indicator detected - may require follow-up",
      snippet: match[0],
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  return flags;
}

/**
 * Detect suspicious links
 */
function detectSuspiciousLinks(content: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  const matches = content.matchAll(PATTERNS.URL);
  for (const match of matches) {
    const url = match[0].toLowerCase();

    // Check for known suspicious patterns
    const isSuspicious =
      url.includes("bit.ly") ||
      url.includes("tinyurl") ||
      url.includes(".tk") ||
      url.includes(".ml") ||
      url.includes("login") ||
      url.includes("verify") ||
      url.includes("password");

    if (isSuspicious) {
      flags.push({
        type: "SUSPICIOUS_LINK",
        reason: "Potentially suspicious link detected",
        snippet: url.slice(0, 30) + "...",
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  return flags;
}

/**
 * Calculate overall severity from flags
 */
function calculateSeverity(
  flags: ModerationFlag[]
): ModerationResult["severity"] {
  if (flags.length === 0) {
    return "none";
  }

  // Critical: self-harm or serious threats
  if (flags.some((f) => f.type === "SELF_HARM")) {
    return "critical";
  }

  // High: threats or PHI
  if (flags.some((f) => f.type === "THREAT" || f.type === "PHI_DETECTED")) {
    return "high";
  }

  // Medium: financial info or crisis indicators
  if (
    flags.some(
      (f) => f.type === "FINANCIAL_INFO" || f.type === "CRISIS_INDICATOR"
    )
  ) {
    return "medium";
  }

  // Low: profanity, contact info, suspicious links
  return "low";
}

/**
 * Sanitize content by redacting flagged content
 */
function sanitizeContent(content: string, flags: ModerationFlag[]): string {
  let sanitized = content;

  // Sort flags by position descending to replace from end to start
  const sortedFlags = [...flags]
    .filter((f) => f.position)
    .sort((a, b) => b.position!.start - a.position!.start);

  for (const flag of sortedFlags) {
    if (flag.position) {
      const before = sanitized.slice(0, flag.position.start);
      const after = sanitized.slice(flag.position.end);
      const redacted = "[REDACTED]";
      sanitized = before + redacted + after;
    }
  }

  return sanitized;
}

/**
 * Quick check if content needs moderation review
 */
export function needsReview(content: string): boolean {
  // Check for high-priority patterns
  const criticalPatterns = [PATTERNS.SELF_HARM, PATTERNS.SSN, PATTERNS.THREAT];

  for (const pattern of criticalPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}
