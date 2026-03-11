/**
 * Duplicate Detection Service
 *
 * Detects duplicate records using fuzzy matching on configurable fields.
 */

import { prisma } from "@/lib/db";
import {
  DuplicateSettings,
  DuplicateMatch,
  DuplicateCheckResult,
  DuplicateMatchField,
  ImportFieldMapping,
  DEFAULT_DUPLICATE_SETTINGS,
} from "./types";
import { DuplicateAction } from "@prisma/client";
import { transformValue } from "./ai-field-mapper";

// ============================================
// DUPLICATE DETECTION
// ============================================

/**
 * Check for duplicates across all import records
 */
export async function checkForDuplicates(
  orgId: string,
  records: Array<{ rowNumber: number; sourceData: Record<string, unknown> }>,
  fieldMappings: ImportFieldMapping[],
  settings: DuplicateSettings = DEFAULT_DUPLICATE_SETTINGS
): Promise<DuplicateCheckResult[]> {
  if (!settings.enabled) {
    return records.map((r) => ({
      rowNumber: r.rowNumber,
      sourceData: r.sourceData,
      matches: [],
      suggestedAction: "CREATE_NEW",
      requiresReview: false,
    }));
  }

  // Get existing clients to match against
  const existingClients = await getExistingClients(orgId);

  const results: DuplicateCheckResult[] = [];

  for (const record of records) {
    // Map source data to target fields
    const mappedData = mapRecordData(record.sourceData, fieldMappings);

    // Find matches
    const matches = findMatches(mappedData, existingClients, settings);

    // Determine suggested action
    const { action, requiresReview } = determineAction(matches, settings);

    results.push({
      rowNumber: record.rowNumber,
      sourceData: record.sourceData,
      matches,
      suggestedAction: action,
      requiresReview,
    });
  }

  return results;
}

/**
 * Check a single record for duplicates
 */
export async function checkSingleRecord(
  orgId: string,
  sourceData: Record<string, unknown>,
  fieldMappings: ImportFieldMapping[],
  settings: DuplicateSettings = DEFAULT_DUPLICATE_SETTINGS
): Promise<DuplicateMatch[]> {
  if (!settings.enabled) {
    return [];
  }

  const existingClients = await getExistingClients(orgId);
  const mappedData = mapRecordData(sourceData, fieldMappings);

  return findMatches(mappedData, existingClients, settings);
}

// ============================================
// MATCHING LOGIC
// ============================================

interface ClientRecord {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  internalId: string | null;
}

/**
 * Get existing clients for duplicate checking
 */
async function getExistingClients(orgId: string): Promise<ClientRecord[]> {
  const clients = await prisma.client.findMany({
    where: {
      orgId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      internalId: true,
    },
  });

  return clients;
}

/**
 * Map source data to target field paths
 */
function mapRecordData(
  sourceData: Record<string, unknown>,
  fieldMappings: ImportFieldMapping[]
): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const mapping of fieldMappings) {
    const value = sourceData[mapping.sourceColumn];
    if (value !== undefined && value !== null && value !== "") {
      const transformed = transformValue(value, mapping.transformer);
      mapped[mapping.targetField] = String(transformed);
    }
  }

  return mapped;
}

/**
 * Find matching clients
 */
function findMatches(
  mappedData: Record<string, string>,
  existingClients: ClientRecord[],
  settings: DuplicateSettings
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const client of existingClients) {
    const matchResult = calculateMatchScore(mappedData, client, settings.matchFields);

    if (matchResult.score >= settings.threshold) {
      matches.push({
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        matchScore: matchResult.score,
        matchedFields: matchResult.matchedFields,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return matches.slice(0, 5); // Return top 5 matches
}

/**
 * Calculate match score between import record and existing client
 */
function calculateMatchScore(
  mappedData: Record<string, string>,
  client: ClientRecord,
  matchFields: DuplicateMatchField[]
): { score: number; matchedFields: DuplicateMatch["matchedFields"] } {
  const matchedFields: DuplicateMatch["matchedFields"] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  for (const field of matchFields) {
    const importValue = getFieldValue(mappedData, field.field);
    const existingValue = getClientFieldValue(client, field.field);

    if (!importValue || !existingValue) continue;

    totalWeight += field.weight;

    const fieldScore = calculateFieldMatch(
      importValue,
      existingValue,
      field.matchType,
      field.caseSensitive
    );

    weightedScore += fieldScore * field.weight;

    if (fieldScore > 0.5) {
      matchedFields.push({
        field: field.field,
        importValue,
        existingValue,
        score: fieldScore,
      });
    }
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return { score: finalScore, matchedFields };
}

/**
 * Get field value from mapped data
 */
function getFieldValue(mappedData: Record<string, string>, fieldPath: string): string | null {
  return mappedData[fieldPath] || null;
}

/**
 * Get field value from client record
 */
function getClientFieldValue(client: ClientRecord, fieldPath: string): string | null {
  switch (fieldPath) {
    case "client.firstName":
      return client.firstName;
    case "client.lastName":
      return client.lastName;
    case "client.phone":
      return client.phone;
    case "client.email":
      return client.email;
    case "client.internalId":
      return client.internalId;
    default:
      return null;
  }
}

/**
 * Calculate match score for a single field
 */
function calculateFieldMatch(
  value1: string,
  value2: string,
  matchType: DuplicateMatchField["matchType"],
  caseSensitive?: boolean
): number {
  // Normalize values if not case sensitive
  const v1 = caseSensitive ? value1 : value1.toLowerCase();
  const v2 = caseSensitive ? value2 : value2.toLowerCase();

  switch (matchType) {
    case "exact":
      return v1 === v2 ? 1 : 0;

    case "normalized":
      // Strip non-alphanumeric for comparison
      const norm1 = v1.replace(/[^a-z0-9]/gi, "");
      const norm2 = v2.replace(/[^a-z0-9]/gi, "");
      return norm1 === norm2 ? 1 : 0;

    case "fuzzy":
      return calculateFuzzyScore(v1, v2);

    case "phonetic":
      return calculatePhoneticScore(v1, v2);

    default:
      return v1 === v2 ? 1 : 0;
  }
}

// ============================================
// FUZZY MATCHING
// ============================================

/**
 * Calculate fuzzy match score using Levenshtein distance
 */
function calculateFuzzyScore(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// ============================================
// PHONETIC MATCHING
// ============================================

/**
 * Calculate phonetic match score using Soundex
 */
function calculatePhoneticScore(s1: string, s2: string): number {
  const soundex1 = soundex(s1);
  const soundex2 = soundex(s2);

  if (soundex1 === soundex2) return 1;

  // Partial match on first few characters
  const matchLength = Math.min(soundex1.length, soundex2.length);
  let matches = 0;
  for (let i = 0; i < matchLength; i++) {
    if (soundex1[i] === soundex2[i]) matches++;
  }

  return matches / 4; // Soundex is 4 characters
}

/**
 * Simple Soundex implementation
 */
function soundex(s: string): string {
  const str = s.toUpperCase().replace(/[^A-Z]/g, "");
  if (str.length === 0) return "0000";

  const codes: Record<string, string> = {
    B: "1", F: "1", P: "1", V: "1",
    C: "2", G: "2", J: "2", K: "2", Q: "2", S: "2", X: "2", Z: "2",
    D: "3", T: "3",
    L: "4",
    M: "5", N: "5",
    R: "6",
  };

  let result = str[0];
  let prevCode = codes[str[0]] || "";

  for (let i = 1; i < str.length && result.length < 4; i++) {
    const code = codes[str[i]];
    if (code && code !== prevCode) {
      result += code;
      prevCode = code;
    } else if (!code) {
      prevCode = "";
    }
  }

  return (result + "0000").slice(0, 4);
}

// ============================================
// ACTION DETERMINATION
// ============================================

/**
 * Determine the suggested action based on matches
 */
function determineAction(
  matches: DuplicateMatch[],
  settings: DuplicateSettings
): { action: DuplicateAction; requiresReview: boolean } {
  if (matches.length === 0) {
    return { action: "CREATE_NEW", requiresReview: false };
  }

  const topMatch = matches[0];

  // High confidence match (>= 95%)
  if (topMatch.matchScore >= 0.95) {
    return {
      action: settings.defaultAction,
      requiresReview: false,
    };
  }

  // Medium confidence match (>= 80%)
  if (topMatch.matchScore >= 0.8) {
    return {
      action: settings.defaultAction,
      requiresReview: true,
    };
  }

  // Low confidence match (above threshold but < 80%)
  return {
    action: "CREATE_NEW",
    requiresReview: true,
  };
}

// ============================================
// BATCH DUPLICATE SUMMARY
// ============================================

/**
 * Get summary of duplicate detection results
 */
export function getDuplicateSummary(
  results: DuplicateCheckResult[]
): {
  totalRecords: number;
  withMatches: number;
  requiresReview: number;
  byAction: Record<DuplicateAction, number>;
} {
  const summary = {
    totalRecords: results.length,
    withMatches: 0,
    requiresReview: 0,
    byAction: {
      SKIP: 0,
      UPDATE: 0,
      CREATE_NEW: 0,
      MERGE: 0,
    } as Record<DuplicateAction, number>,
  };

  for (const result of results) {
    if (result.matches.length > 0) {
      summary.withMatches++;
    }
    if (result.requiresReview) {
      summary.requiresReview++;
    }
    summary.byAction[result.suggestedAction]++;
  }

  return summary;
}
