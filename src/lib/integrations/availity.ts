/**
 * Availity Integration Module
 *
 * Provides insurance eligibility verification through the Availity API.
 * Supports real-time 270/271 EDI transaction processing.
 *
 * Documentation: https://developer.availity.com/
 *
 * Environment variables:
 * - AVAILITY_CLIENT_ID: OAuth client ID
 * - AVAILITY_CLIENT_SECRET: OAuth client secret
 * - AVAILITY_API_URL: API base URL (defaults to sandbox)
 *
 * @module lib/integrations/availity
 */

// ============================================
// TYPES
// ============================================

export interface AvailityConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  isStubMode: boolean;
}

export interface EligibilityRequest {
  // Subscriber (insured person) information
  subscriberFirstName: string;
  subscriberLastName: string;
  subscriberDob: string; // YYYY-MM-DD
  subscriberGender?: "M" | "F" | "U";
  memberId: string;

  // Patient (if different from subscriber)
  patientFirstName?: string;
  patientLastName?: string;
  patientDob?: string;
  patientRelation?: "self" | "spouse" | "child" | "other";

  // Insurance information
  payerCode: string; // Standard payer ID
  groupNumber?: string;

  // Provider information
  providerNpi: string;
  providerTaxId?: string;
  providerName?: string;

  // Service information
  serviceCode?: string; // CPT code or service type code
  serviceDateFrom?: string; // YYYY-MM-DD
  serviceDateTo?: string;
}

export interface EligibilityResponse {
  // Transaction status
  success: boolean;
  requestId: string;
  errorCode?: string;
  errorMessage?: string;

  // Eligibility result
  isEligible: boolean;

  // Plan information
  planName: string;
  memberId: string;
  groupNumber?: string;

  // Coverage dates
  effectiveDate: string;
  terminationDate?: string;

  // Cost sharing
  copay?: number;
  copayDescription?: string;
  deductible?: number;
  deductibleRemaining?: number;
  coinsurance?: number; // Percentage (e.g., 20 for 20%)
  outOfPocketMax?: number;
  outOfPocketRemaining?: number;

  // Authorization requirements
  priorAuthRequired: boolean;
  priorAuthPhone?: string;

  // Limitations and exclusions
  limitations?: string[];
  exclusions?: string[];
  notes?: string[];

  // Network status
  inNetwork?: boolean;

  // Raw response for debugging/audit
  rawResponse?: string;
}

export interface Payer {
  code: string;
  name: string;
  tradingPartnerId?: string;
  type: "commercial" | "medicaid" | "medicare" | "other";
  supportsRealTime: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

let cachedConfig: AvailityConfig | null = null;
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get Availity configuration from environment
 */
function getConfig(): AvailityConfig {
  if (cachedConfig) return cachedConfig;

  const clientId = process.env.AVAILITY_CLIENT_ID;
  const clientSecret = process.env.AVAILITY_CLIENT_SECRET;
  const baseUrl =
    process.env.AVAILITY_API_URL || "https://apps.availity.com/api/v1";

  // Check if we should run in stub mode (credentials not configured)
  const isStubMode = !clientId || !clientSecret;

  cachedConfig = {
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    baseUrl,
    isStubMode,
  };

  if (isStubMode) {
    console.log(
      "[Availity] Running in stub mode - Availity credentials not configured"
    );
  }

  return cachedConfig;
}

/**
 * Check if Availity is configured
 */
export function isAvailityConfigured(): boolean {
  const config = getConfig();
  return !config.isStubMode;
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Get access token (with caching)
 */
async function getAccessToken(): Promise<string> {
  const config = getConfig();

  if (config.isStubMode) {
    return "stub-token";
  }

  // Return cached token if still valid (with 5 minute buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 300000) {
    return accessToken;
  }

  // Request new token
  const tokenUrl = `${config.baseUrl}/oauth2/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "eligibility",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Availity] Token request failed:", error);
    throw new Error(`Failed to authenticate with Availity: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  return accessToken as string;
}

// ============================================
// ELIGIBILITY CHECK
// ============================================

/**
 * Check insurance eligibility
 *
 * @param request - Eligibility request parameters
 * @returns Eligibility response with coverage details
 */
export async function checkEligibility(
  request: EligibilityRequest
): Promise<EligibilityResponse> {
  const config = getConfig();

  // Use stub response if not configured
  if (config.isStubMode) {
    console.log("[Availity] Using stub response for eligibility check");
    return generateStubResponse(request);
  }

  try {
    const token = await getAccessToken();

    // Build 270 transaction request
    const payload = build270Request(request);

    const response = await fetch(`${config.baseUrl}/eligibility`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Availity] Eligibility check failed:", errorBody);

      return {
        success: false,
        requestId: `error-${Date.now()}`,
        errorCode: `HTTP_${response.status}`,
        errorMessage: `Eligibility check failed: ${response.statusText}`,
        isEligible: false,
        planName: "",
        memberId: request.memberId,
        effectiveDate: "",
        priorAuthRequired: false,
        rawResponse: errorBody,
      };
    }

    const data = await response.json();
    return parseEligibilityResponse(data, request);
  } catch (error) {
    console.error("[Availity] Eligibility check error:", error);

    return {
      success: false,
      requestId: `error-${Date.now()}`,
      errorCode: "CONNECTION_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Connection error occurred",
      isEligible: false,
      planName: "",
      memberId: request.memberId,
      effectiveDate: "",
      priorAuthRequired: false,
    };
  }
}

/**
 * Build 270 eligibility request payload
 */
function build270Request(request: EligibilityRequest): Record<string, unknown> {
  const today = new Date().toISOString().split("T")[0];

  return {
    transactionCode: "270",
    tradingPartnerServiceId: request.payerCode,
    provider: {
      organizationName: request.providerName || "Healthcare Provider",
      npi: request.providerNpi,
      taxId: request.providerTaxId,
    },
    subscriber: {
      memberId: request.memberId,
      firstName: request.subscriberFirstName,
      lastName: request.subscriberLastName,
      birthDate: request.subscriberDob,
      gender: request.subscriberGender || "U",
      groupNumber: request.groupNumber,
    },
    // Include dependent info if patient is different from subscriber
    ...(request.patientFirstName &&
      request.patientRelation !== "self" && {
        dependents: [
          {
            firstName: request.patientFirstName,
            lastName: request.patientLastName || request.subscriberLastName,
            birthDate: request.patientDob || request.subscriberDob,
            relationship: mapRelationshipCode(request.patientRelation),
          },
        ],
      }),
    encounter: {
      serviceTypeCodes: request.serviceCode
        ? [request.serviceCode]
        : ["30"], // 30 = Health Benefit Plan Coverage
      beginningDateOfService: request.serviceDateFrom || today,
      endDateOfService: request.serviceDateTo || today,
    },
  };
}

/**
 * Map relationship to X12 code
 */
function mapRelationshipCode(relation?: string): string {
  const codes: Record<string, string> = {
    self: "18",
    spouse: "01",
    child: "19",
    other: "21",
  };
  return codes[relation || "self"] || "18";
}

/**
 * Parse 271 eligibility response
 *
 * Extracts structured data from the Availity API response.
 */
export function parseEligibilityResponse(
  data: Record<string, unknown>,
  originalRequest: EligibilityRequest
): EligibilityResponse {
  try {
    // Extract main fields from response
    const eligibility = data.eligibility || data.benefitInformation || data;
    const subscriber =
      (data.subscriber as Record<string, unknown>) || ({} as Record<string, unknown>);
    const planInfo =
      (data.planInformation as Record<string, unknown>) ||
      (data.plan as Record<string, unknown>) ||
      ({} as Record<string, unknown>);
    const benefits =
      (data.benefits as Record<string, unknown>[]) ||
      (eligibility as Record<string, unknown>).benefits ||
      ([] as Record<string, unknown>[]);

    // Determine eligibility status
    const isEligible = determineEligibility(data);

    // Extract cost sharing from benefits
    const costSharing = extractCostSharing(
      benefits as Record<string, unknown>[]
    );

    // Extract limitations and notes
    const { limitations, exclusions, notes } = extractLimitationsAndNotes(
      data as Record<string, unknown>
    );

    // Check for prior auth requirement
    const priorAuthRequired = checkPriorAuthRequired(
      benefits as Record<string, unknown>[]
    );

    return {
      success: true,
      requestId:
        (data.requestId as string) ||
        (data.transactionId as string) ||
        `req-${Date.now()}`,
      isEligible,

      // Plan information
      planName:
        (planInfo.name as string) ||
        (planInfo.planName as string) ||
        (data.planName as string) ||
        "Unknown Plan",
      memberId:
        (subscriber.memberId as string) || originalRequest.memberId,
      groupNumber:
        (subscriber.groupNumber as string) || originalRequest.groupNumber,

      // Coverage dates
      effectiveDate:
        (planInfo.effectiveDate as string) ||
        (subscriber.effectiveDate as string) ||
        "",
      terminationDate:
        (planInfo.terminationDate as string) ||
        (subscriber.terminationDate as string),

      // Cost sharing
      ...costSharing,

      // Prior authorization
      priorAuthRequired,
      priorAuthPhone: (data.priorAuthPhone as string) || undefined,

      // Limitations
      limitations: limitations.length > 0 ? limitations : undefined,
      exclusions: exclusions.length > 0 ? exclusions : undefined,
      notes: notes.length > 0 ? notes : undefined,

      // Network status
      inNetwork: (data.inNetwork as boolean) ?? undefined,

      // Raw response for audit
      rawResponse: JSON.stringify(data),
    };
  } catch (error) {
    console.error("[Availity] Error parsing response:", error);

    return {
      success: false,
      requestId: `parse-error-${Date.now()}`,
      errorCode: "PARSE_ERROR",
      errorMessage: "Failed to parse eligibility response",
      isEligible: false,
      planName: "",
      memberId: originalRequest.memberId,
      effectiveDate: "",
      priorAuthRequired: false,
      rawResponse: JSON.stringify(data),
    };
  }
}

/**
 * Determine if the member is eligible based on response data
 */
function determineEligibility(data: Record<string, unknown>): boolean {
  // Check various possible eligibility indicators
  if (typeof data.eligible === "boolean") return data.eligible;
  if (typeof data.isEligible === "boolean") return data.isEligible;

  // Check status field
  const status = (data.status as string)?.toLowerCase() || "";
  if (status.includes("active") || status.includes("eligible")) return true;
  if (status.includes("inactive") || status.includes("terminated"))
    return false;

  // Check eligibility status code (X12 EB01)
  const eligibilityCode = data.eligibilityCode as string;
  if (eligibilityCode === "1") return true; // Active Coverage
  if (eligibilityCode === "6") return false; // Inactive

  // Check benefit information
  const benefits = data.benefits as Record<string, unknown>[];
  if (Array.isArray(benefits) && benefits.length > 0) {
    const hasActiveBenefit = benefits.some((b) => {
      const code = (b.eligibilityCode as string) || (b.code as string);
      return code === "1" || code === "A";
    });
    if (hasActiveBenefit) return true;
  }

  // Default to false if unable to determine
  return false;
}

/**
 * Extract cost sharing information from benefits
 */
function extractCostSharing(benefits: Record<string, unknown>[]): {
  copay?: number;
  copayDescription?: string;
  deductible?: number;
  deductibleRemaining?: number;
  coinsurance?: number;
  outOfPocketMax?: number;
  outOfPocketRemaining?: number;
} {
  const result: {
    copay?: number;
    copayDescription?: string;
    deductible?: number;
    deductibleRemaining?: number;
    coinsurance?: number;
    outOfPocketMax?: number;
    outOfPocketRemaining?: number;
  } = {};

  for (const benefit of benefits) {
    const type =
      (benefit.benefitType as string) || (benefit.type as string) || "";
    const amount = parseFloat(String(benefit.amount || benefit.value || 0));

    switch (type.toUpperCase()) {
      case "COPAY":
      case "CO-PAYMENT":
      case "B":
        if (!result.copay) {
          result.copay = amount;
          result.copayDescription = benefit.description as string;
        }
        break;

      case "DEDUCTIBLE":
      case "C":
        if (!result.deductible) {
          result.deductible = amount;
          // Check for remaining amount
          if (benefit.remainingAmount !== undefined) {
            result.deductibleRemaining = parseFloat(
              String(benefit.remainingAmount)
            );
          }
        }
        break;

      case "COINSURANCE":
      case "A":
        if (!result.coinsurance) {
          result.coinsurance = amount; // Percentage
        }
        break;

      case "OUT_OF_POCKET":
      case "OUT-OF-POCKET":
      case "G":
        if (!result.outOfPocketMax) {
          result.outOfPocketMax = amount;
          if (benefit.remainingAmount !== undefined) {
            result.outOfPocketRemaining = parseFloat(
              String(benefit.remainingAmount)
            );
          }
        }
        break;
    }
  }

  return result;
}

/**
 * Extract limitations and notes from response
 */
function extractLimitationsAndNotes(data: Record<string, unknown>): {
  limitations: string[];
  exclusions: string[];
  notes: string[];
} {
  const limitations: string[] = [];
  const exclusions: string[] = [];
  const notes: string[] = [];

  // Check for explicit arrays
  if (Array.isArray(data.limitations)) {
    limitations.push(
      ...data.limitations.map((l) => (typeof l === "string" ? l : String(l)))
    );
  }
  if (Array.isArray(data.exclusions)) {
    exclusions.push(
      ...data.exclusions.map((e) => (typeof e === "string" ? e : String(e)))
    );
  }
  if (Array.isArray(data.notes)) {
    notes.push(
      ...data.notes.map((n) => (typeof n === "string" ? n : String(n)))
    );
  }

  // Check benefits for additional limitations
  const benefits = data.benefits as Record<string, unknown>[];
  if (Array.isArray(benefits)) {
    for (const benefit of benefits) {
      if (benefit.limitation && typeof benefit.limitation === "string") {
        limitations.push(benefit.limitation);
      }
      if (benefit.note && typeof benefit.note === "string") {
        notes.push(benefit.note);
      }
    }
  }

  return { limitations, exclusions, notes };
}

/**
 * Check if prior authorization is required
 */
function checkPriorAuthRequired(benefits: Record<string, unknown>[]): boolean {
  for (const benefit of benefits) {
    if (benefit.priorAuthRequired === true) return true;
    if (benefit.authorizationRequired === true) return true;

    // Check authorization indicator codes
    const authCode = (benefit.authorizationCode as string) || "";
    if (authCode === "Y" || authCode === "1") return true;
  }

  return false;
}

// ============================================
// PAYER LIST
// ============================================

/**
 * Get list of supported payers
 *
 * Returns a curated list of common payers. In production, this could
 * be fetched from the Availity payer list API.
 */
export async function getPayerList(): Promise<Payer[]> {
  const config = getConfig();

  // If configured, try to fetch from API
  if (!config.isStubMode) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${config.baseUrl}/payers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return parsePayerList(data);
      }
    } catch (error) {
      console.error("[Availity] Failed to fetch payer list:", error);
    }
  }

  // Return static list as fallback
  return getStaticPayerList();
}

/**
 * Parse payer list from API response
 */
function parsePayerList(data: Record<string, unknown>): Payer[] {
  const payers = (data.payers || data.tradingPartners || []) as Record<
    string,
    unknown
  >[];
  return payers.map((p) => ({
    code: (p.payerId as string) || (p.id as string) || "",
    name: (p.payerName as string) || (p.name as string) || "",
    tradingPartnerId: p.tradingPartnerId as string,
    type: mapPayerType(p.type as string),
    supportsRealTime: (p.supportsRealTime as boolean) ?? true,
  }));
}

/**
 * Map payer type to standard enum
 */
function mapPayerType(
  type?: string
): "commercial" | "medicaid" | "medicare" | "other" {
  const t = type?.toLowerCase() || "";
  if (t.includes("medicaid")) return "medicaid";
  if (t.includes("medicare")) return "medicare";
  if (t.includes("commercial") || t.includes("private")) return "commercial";
  return "other";
}

/**
 * Get static payer list (fallback)
 */
function getStaticPayerList(): Payer[] {
  return [
    // Major Commercial Payers
    {
      code: "60054",
      name: "Aetna",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "00112",
      name: "Anthem Blue Cross",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "SB580",
      name: "Blue Cross Blue Shield",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "87726",
      name: "Cigna",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "00510",
      name: "Humana",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "60054",
      name: "Kaiser Permanente",
      type: "commercial",
      supportsRealTime: true,
    },
    {
      code: "87726",
      name: "UnitedHealthcare",
      type: "commercial",
      supportsRealTime: true,
    },

    // Medicare
    {
      code: "CMS",
      name: "Medicare",
      type: "medicare",
      supportsRealTime: true,
    },
    {
      code: "CMSMA",
      name: "Medicare Advantage",
      type: "medicare",
      supportsRealTime: true,
    },

    // Medicaid (varies by state)
    {
      code: "CALMCD",
      name: "California Medi-Cal",
      type: "medicaid",
      supportsRealTime: true,
    },
    {
      code: "TXMCD",
      name: "Texas Medicaid",
      type: "medicaid",
      supportsRealTime: true,
    },
    {
      code: "NYMCD",
      name: "New York Medicaid",
      type: "medicaid",
      supportsRealTime: true,
    },
    {
      code: "FLMCD",
      name: "Florida Medicaid",
      type: "medicaid",
      supportsRealTime: true,
    },

    // Other major payers
    {
      code: "59140",
      name: "Tricare",
      type: "other",
      supportsRealTime: true,
    },
    {
      code: "VAHLTH",
      name: "VA Health",
      type: "other",
      supportsRealTime: true,
    },
  ];
}

// ============================================
// STUB RESPONSES (Development/Testing)
// ============================================

/**
 * Generate a realistic stub response for development
 */
function generateStubResponse(request: EligibilityRequest): EligibilityResponse {
  // Simulate some randomness for testing
  const random = Math.random();
  const isEligible = random > 0.1; // 90% eligible

  // Generate deterministic but realistic values based on member ID
  const hash = hashCode(request.memberId);
  const copay = (Math.abs(hash % 4) + 1) * 10; // $10, $20, $30, or $40
  const deductible = (Math.abs(hash % 3) + 1) * 500; // $500, $1000, or $1500
  const coinsurance = [10, 20, 30][Math.abs(hash % 3)]; // 10%, 20%, or 30%

  return {
    success: true,
    requestId: `stub-${Date.now()}`,
    isEligible,

    planName: `${getPayerName(request.payerCode)} ${isEligible ? "Gold" : "Basic"} Plan`,
    memberId: request.memberId,
    groupNumber: request.groupNumber,

    effectiveDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terminationDate: undefined,

    copay,
    copayDescription: "Per visit",
    deductible,
    deductibleRemaining: Math.round(deductible * 0.6),
    coinsurance,
    outOfPocketMax: 5000,
    outOfPocketRemaining: 3500,

    priorAuthRequired: random > 0.7,
    priorAuthPhone: random > 0.7 ? "1-800-555-0123" : undefined,

    limitations: isEligible
      ? ["Limited to 20 visits per year", "Pre-authorization required for specialist visits"]
      : undefined,
    notes: ["Stub response - not from actual Availity API"],

    inNetwork: true,
  };
}

/**
 * Get payer name from code
 */
function getPayerName(payerCode: string): string {
  const payers = getStaticPayerList();
  const payer = payers.find((p) => p.code === payerCode);
  return payer?.name || "Healthcare Insurance";
}

/**
 * Simple hash function for deterministic random values
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
