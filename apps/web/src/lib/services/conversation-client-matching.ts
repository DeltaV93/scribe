/**
 * Conversation Client Matching Service
 *
 * Extracts PII from conversation transcripts and matches against existing clients.
 * Built on top of the duplicate-detector.ts fuzzy matching algorithms.
 */

import { prisma } from "@/lib/db";
import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";

// ============================================
// TYPES
// ============================================

export interface ExtractedPII {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
}

export interface ClientMatch {
  clientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  overallConfidence: number;
  matchedIdentifiers: MatchedIdentifier[];
}

export interface MatchedIdentifier {
  type: "name" | "phone" | "email";
  extractedValue: string;
  matchedValue: string;
  similarity: number;
}

export interface ClientMatchResult {
  success: boolean;
  extractedPII: ExtractedPII;
  suggestions: ClientMatch[];
  tokensUsed?: { input: number; output: number };
  error?: string;
}

// Field weights for confidence calculation
// Note: Client model doesn't have DOB, so we only use name, phone, email
const FIELD_WEIGHTS = {
  name: 0.45,   // Name is most important
  phone: 0.35,  // Phone is strong identifier
  email: 0.20,  // Email is good identifier
};

// ============================================
// PII EXTRACTION FROM TRANSCRIPT
// ============================================

/**
 * Extract personally identifiable information from a transcript using Claude
 */
export async function extractPIIFromTranscript(
  transcript: string
): Promise<{ pii: ExtractedPII; tokensUsed: { input: number; output: number } }> {
  const prompt = `You are extracting personally identifiable information (PII) from a conversation transcript.

Extract the following information about the CLIENT (not staff/case manager) if mentioned:
- First name
- Last name
- Full name (if only full name is given)
- Phone number
- Email address
- Date of birth
- Address

IMPORTANT:
- Only extract information explicitly stated by or about the client
- Do not infer or guess information
- If a field is not mentioned, omit it from the response
- Normalize phone numbers to digits only (e.g., "555-123-4567" → "5551234567")
- Normalize dates to ISO format (YYYY-MM-DD)
- For names, use proper capitalization

Respond with a JSON object containing only the fields that were found:
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "5551234567",
  "email": "john@example.com",
  "dob": "1985-03-15",
  "address": "123 Main St, City, ST 12345"
}

TRANSCRIPT:
${transcript.slice(0, 8000)}`;

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return { pii: {}, tokensUsed: { input: 0, output: 0 } };
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { pii: {}, tokensUsed: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
    }

    const pii = JSON.parse(jsonMatch[0]) as ExtractedPII;

    return {
      pii,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("[ClientMatching] Error extracting PII:", error);
    return { pii: {}, tokensUsed: { input: 0, output: 0 } };
  }
}

// ============================================
// CLIENT MATCHING
// ============================================

interface ClientRecord {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}

/**
 * Find matching clients based on extracted PII
 */
export async function findMatchingClients(
  orgId: string,
  pii: ExtractedPII,
  minConfidence: number = 0.70
): Promise<ClientMatch[]> {
  // Need at least one identifier to search
  const hasName = pii.firstName || pii.lastName || pii.fullName;
  const hasContact = pii.phone || pii.email;

  if (!hasName && !hasContact) {
    return [];
  }

  // Parse full name if provided
  let firstName = pii.firstName;
  let lastName = pii.lastName;
  if (!firstName && !lastName && pii.fullName) {
    const parts = pii.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    } else if (parts.length === 1) {
      firstName = parts[0];
    }
  }

  // Build search query
  const whereConditions: Array<Record<string, unknown>> = [];

  // Phone exact match (normalized)
  if (pii.phone) {
    const normalizedPhone = normalizePhone(pii.phone);
    if (normalizedPhone.length >= 10) {
      whereConditions.push({ phone: normalizedPhone });
    }
  }

  // Email exact match
  if (pii.email) {
    whereConditions.push({ email: { equals: pii.email, mode: "insensitive" } });
  }

  // Name fuzzy match (using prefix search)
  if (firstName && lastName) {
    whereConditions.push({
      AND: [
        { firstName: { startsWith: firstName.substring(0, 3), mode: "insensitive" } },
        { lastName: { startsWith: lastName.substring(0, 3), mode: "insensitive" } },
      ],
    });
    // Also check for swapped names
    whereConditions.push({
      AND: [
        { firstName: { startsWith: lastName.substring(0, 3), mode: "insensitive" } },
        { lastName: { startsWith: firstName.substring(0, 3), mode: "insensitive" } },
      ],
    });
  } else if (firstName) {
    whereConditions.push({ firstName: { startsWith: firstName.substring(0, 3), mode: "insensitive" } });
  } else if (lastName) {
    whereConditions.push({ lastName: { startsWith: lastName.substring(0, 3), mode: "insensitive" } });
  }

  if (whereConditions.length === 0) {
    return [];
  }

  // Fetch potential matches
  const clients = await prisma.client.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: whereConditions,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
    take: 20, // Limit to prevent performance issues
  });

  // Score each client
  const matches: ClientMatch[] = [];

  for (const client of clients) {
    const { confidence, matchedIdentifiers } = calculateClientMatchScore(
      pii,
      client,
      firstName,
      lastName
    );

    if (confidence >= minConfidence) {
      matches.push({
        clientId: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        overallConfidence: confidence,
        matchedIdentifiers,
      });
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.overallConfidence - a.overallConfidence);

  // Return top 5
  return matches.slice(0, 5);
}

/**
 * Calculate match score between extracted PII and a client record
 */
function calculateClientMatchScore(
  pii: ExtractedPII,
  client: ClientRecord,
  parsedFirstName?: string,
  parsedLastName?: string
): { confidence: number; matchedIdentifiers: MatchedIdentifier[] } {
  const matchedIdentifiers: MatchedIdentifier[] = [];
  let totalWeight = 0;
  let weightedScore = 0;

  const firstName = parsedFirstName || pii.firstName;
  const lastName = parsedLastName || pii.lastName;

  // Name matching (combined first + last)
  if (firstName || lastName) {
    totalWeight += FIELD_WEIGHTS.name;

    let nameScore = 0;
    let bestNameMatch = "";
    let clientNameValue = "";

    if (firstName && lastName) {
      // Full name comparison
      const extractedFull = `${firstName} ${lastName}`.toLowerCase();
      const clientFull = `${client.firstName} ${client.lastName}`.toLowerCase();
      const clientSwapped = `${client.lastName} ${client.firstName}`.toLowerCase();

      const directScore = calculateStringSimilarity(extractedFull, clientFull);
      const swappedScore = calculateStringSimilarity(extractedFull, clientSwapped);

      if (directScore >= swappedScore) {
        nameScore = directScore;
        bestNameMatch = `${firstName} ${lastName}`;
        clientNameValue = `${client.firstName} ${client.lastName}`;
      } else {
        nameScore = swappedScore;
        bestNameMatch = `${firstName} ${lastName}`;
        clientNameValue = `${client.lastName} ${client.firstName} (swapped)`;
      }
    } else if (firstName) {
      nameScore = calculateStringSimilarity(firstName.toLowerCase(), client.firstName.toLowerCase());
      bestNameMatch = firstName;
      clientNameValue = client.firstName;
    } else if (lastName) {
      nameScore = calculateStringSimilarity(lastName.toLowerCase(), client.lastName.toLowerCase());
      bestNameMatch = lastName;
      clientNameValue = client.lastName;
    }

    weightedScore += nameScore * FIELD_WEIGHTS.name;

    if (nameScore > 0.5) {
      matchedIdentifiers.push({
        type: "name",
        extractedValue: bestNameMatch,
        matchedValue: clientNameValue,
        similarity: nameScore,
      });
    }
  }

  // Phone matching
  if (pii.phone) {
    totalWeight += FIELD_WEIGHTS.phone;

    const normalizedExtracted = normalizePhone(pii.phone);
    const normalizedClient = normalizePhone(client.phone);

    if (normalizedExtracted.length >= 10 && normalizedClient.length >= 10) {
      // Check last 10 digits (handles country codes)
      const extracted10 = normalizedExtracted.slice(-10);
      const client10 = normalizedClient.slice(-10);

      const phoneScore = extracted10 === client10 ? 1.0 : 0;
      weightedScore += phoneScore * FIELD_WEIGHTS.phone;

      if (phoneScore > 0) {
        matchedIdentifiers.push({
          type: "phone",
          extractedValue: pii.phone,
          matchedValue: client.phone,
          similarity: phoneScore,
        });
      }
    }
  }

  // Email matching
  if (pii.email && client.email) {
    totalWeight += FIELD_WEIGHTS.email;

    const emailScore = pii.email.toLowerCase() === client.email.toLowerCase() ? 1.0 : 0;
    weightedScore += emailScore * FIELD_WEIGHTS.email;

    if (emailScore > 0) {
      matchedIdentifiers.push({
        type: "email",
        extractedValue: pii.email,
        matchedValue: client.email,
        similarity: emailScore,
      });
    }
  }

  // Note: DOB matching not available - Client model doesn't have dateOfBirth field
  // If DOB is added to Client in the future, matching can be added here

  // Calculate final confidence
  const confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return { confidence, matchedIdentifiers };
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Find matching clients from a conversation transcript
 */
export async function suggestClientsFromTranscript(
  orgId: string,
  transcript: string,
  minConfidence: number = 0.70
): Promise<ClientMatchResult> {
  try {
    // Step 1: Extract PII from transcript
    const { pii, tokensUsed } = await extractPIIFromTranscript(transcript);

    if (Object.keys(pii).length === 0) {
      return {
        success: true,
        extractedPII: {},
        suggestions: [],
        tokensUsed,
      };
    }

    // Step 2: Find matching clients
    const suggestions = await findMatchingClients(orgId, pii, minConfidence);

    return {
      success: true,
      extractedPII: pii,
      suggestions,
      tokensUsed,
    };
  } catch (error) {
    console.error("[ClientMatching] Error suggesting clients:", error);
    return {
      success: false,
      extractedPII: {},
      suggestions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Find matching clients from pre-extracted PII (no Claude call)
 */
export async function suggestClientsFromPII(
  orgId: string,
  pii: ExtractedPII,
  minConfidence: number = 0.70
): Promise<ClientMatchResult> {
  try {
    const suggestions = await findMatchingClients(orgId, pii, minConfidence);

    return {
      success: true,
      extractedPII: pii,
      suggestions,
    };
  } catch (error) {
    console.error("[ClientMatching] Error suggesting clients from PII:", error);
    return {
      success: false,
      extractedPII: pii,
      suggestions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// UTILITY FUNCTIONS (from duplicate-detector.ts)
// ============================================

/**
 * Normalize phone number to digits only
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Calculate string similarity using Sørensen–Dice coefficient
 * (Bigram-based similarity - fast and effective for names)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }

  const bigrams2: string[] = [];
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.push(str2.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigrams2) {
    if (bigrams1.has(bigram)) {
      intersection++;
      bigrams1.delete(bigram); // Only count once
    }
  }

  return (2 * intersection) / (str1.length - 1 + str2.length - 1);
}

/**
 * Calculate Levenshtein distance between two strings
 * (More accurate but slower - use for final scoring if needed)
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate Levenshtein similarity (0-1 scale)
 */
export function levenshteinSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}
