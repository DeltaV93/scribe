/**
 * State Consent Rules Service (PX-736)
 * Manages state-by-state consent requirements
 */

import { prisma } from "@/lib/db";
import { StateConsentType, Prisma } from "@prisma/client";

export interface ConsentRequirements {
  consentType: StateConsentType;
  requiresExplicitOptIn: boolean;
  silenceImpliesConsent: boolean;
  stateCode: string;
  stateName: string;
}

/**
 * Get consent requirements for a call based on location
 * Uses the stricter rule when states differ
 */
export async function getConsentRequirementsForCall(params: {
  orgState: string;
  clientAreaCode?: string;
}): Promise<ConsentRequirements> {
  const { orgState, clientAreaCode } = params;

  // Get org's state rule
  const orgRule = await prisma.stateConsentRule.findUnique({
    where: { stateCode: orgState.toUpperCase() },
  });

  // If we have a client area code, try to determine their state
  let clientRule = null;
  if (clientAreaCode) {
    const clientState = areaCodeToState(clientAreaCode);
    if (clientState && clientState !== orgState.toUpperCase()) {
      clientRule = await prisma.stateConsentRule.findUnique({
        where: { stateCode: clientState },
      });
    }
  }

  // Use the stricter rule (TWO_PARTY is stricter than ONE_PARTY)
  const rules = [orgRule, clientRule].filter(Boolean);

  // If no rules found, default to TWO_PARTY (safer)
  if (rules.length === 0) {
    return {
      consentType: StateConsentType.TWO_PARTY,
      requiresExplicitOptIn: true,
      silenceImpliesConsent: false,
      stateCode: orgState.toUpperCase(),
      stateName: "Unknown",
    };
  }

  // Find the strictest rule
  const strictestRule = rules.reduce((strictest, current) => {
    if (!strictest) return current!;
    if (!current) return strictest;

    // TWO_PARTY is stricter
    if (current.consentType === StateConsentType.TWO_PARTY) {
      return current;
    }
    return strictest;
  }, rules[0]!);

  // strictestRule is guaranteed to be non-null since rules.length > 0
  return {
    consentType: strictestRule!.consentType,
    requiresExplicitOptIn: strictestRule!.requiresExplicitOptIn,
    silenceImpliesConsent: strictestRule!.silenceImpliesConsent,
    stateCode: strictestRule!.stateCode,
    stateName: strictestRule!.stateName,
  };
}

/**
 * Get all state consent rules
 */
export async function getAllStateRules() {
  return prisma.stateConsentRule.findMany({
    orderBy: { stateName: "asc" },
  });
}

/**
 * Get a specific state's consent rule
 */
export async function getStateRule(stateCode: string) {
  return prisma.stateConsentRule.findUnique({
    where: { stateCode: stateCode.toUpperCase() },
  });
}

/**
 * Create or update a state consent rule (admin only)
 */
export async function upsertStateRule(params: {
  stateCode: string;
  stateName: string;
  consentType: StateConsentType;
  requiresExplicitOptIn?: boolean;
  silenceImpliesConsent?: boolean;
  minorAgeThreshold?: number;
  additionalRules?: Prisma.InputJsonValue;
  effectiveDate: Date;
  notes?: string;
}) {
  const {
    stateCode,
    stateName,
    consentType,
    requiresExplicitOptIn = true,
    silenceImpliesConsent = false,
    minorAgeThreshold = 18,
    additionalRules,
    effectiveDate,
    notes,
  } = params;

  return prisma.stateConsentRule.upsert({
    where: { stateCode: stateCode.toUpperCase() },
    create: {
      stateCode: stateCode.toUpperCase(),
      stateName,
      consentType,
      requiresExplicitOptIn,
      silenceImpliesConsent,
      minorAgeThreshold,
      additionalRules,
      effectiveDate,
      notes,
    },
    update: {
      stateName,
      consentType,
      requiresExplicitOptIn,
      silenceImpliesConsent,
      minorAgeThreshold,
      additionalRules,
      effectiveDate,
      notes,
      lastReviewedAt: new Date(),
    },
  });
}

/**
 * Seed California rule (two-party consent state)
 * Run this in database seed or migration
 */
export async function seedCaliforniaRule() {
  return upsertStateRule({
    stateCode: "CA",
    stateName: "California",
    consentType: StateConsentType.TWO_PARTY,
    requiresExplicitOptIn: true,
    silenceImpliesConsent: true, // Per user decision: staying on line = consent
    minorAgeThreshold: 18,
    effectiveDate: new Date("1967-01-01"), // CA Penal Code 632
    notes:
      "California Penal Code Section 632. Two-party consent required. All parties must consent to recording.",
    additionalRules: {
      penalCode: "632",
      maxPenalty: "Up to $2,500 fine and/or imprisonment",
      civilLiability: true,
    },
  });
}

/**
 * Map area code to state (simplified - real implementation would use full database)
 * This is a subset for demonstration - expand as needed
 */
function areaCodeToState(areaCode: string): string | null {
  const areaCodeMap: Record<string, string> = {
    // California
    "209": "CA", "213": "CA", "310": "CA", "323": "CA", "408": "CA",
    "415": "CA", "424": "CA", "510": "CA", "530": "CA", "559": "CA",
    "562": "CA", "619": "CA", "626": "CA", "650": "CA", "657": "CA",
    "661": "CA", "669": "CA", "707": "CA", "714": "CA", "747": "CA",
    "760": "CA", "805": "CA", "818": "CA", "831": "CA", "858": "CA",
    "909": "CA", "916": "CA", "925": "CA", "949": "CA", "951": "CA",
    // New York
    "212": "NY", "315": "NY", "347": "NY", "516": "NY", "518": "NY",
    "585": "NY", "607": "NY", "631": "NY", "646": "NY", "716": "NY",
    "718": "NY", "845": "NY", "914": "NY", "917": "NY", "929": "NY",
    // Texas
    "210": "TX", "214": "TX", "254": "TX", "281": "TX", "325": "TX",
    "361": "TX", "409": "TX", "430": "TX", "432": "TX", "469": "TX",
    "512": "TX", "682": "TX", "713": "TX", "806": "TX", "817": "TX",
    "830": "TX", "832": "TX", "903": "TX", "915": "TX", "936": "TX",
    "940": "TX", "956": "TX", "972": "TX", "979": "TX",
    // Florida
    "239": "FL", "305": "FL", "321": "FL", "352": "FL", "386": "FL",
    "407": "FL", "561": "FL", "727": "FL", "754": "FL", "772": "FL",
    "786": "FL", "813": "FL", "850": "FL", "863": "FL", "904": "FL",
    "941": "FL", "954": "FL",
  };

  return areaCodeMap[areaCode] || null;
}

/**
 * Check if in-person recording requires verbal consent acknowledgment
 * Always returns true for now - case manager must confirm verbal consent
 */
export function requiresInPersonConsentAcknowledgment(): boolean {
  return true;
}
