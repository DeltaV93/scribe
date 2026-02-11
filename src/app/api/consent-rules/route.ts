/**
 * State Consent Rules API (PX-736)
 * GET: List all state consent rules
 * POST: Create/update a state rule (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth-audit";
import {
  getAllStateRules,
  upsertStateRule,
  getConsentRequirementsForCall,
} from "@/lib/services/consent-rules";
import { StateConsentType, UserRole } from "@prisma/client";

/**
 * GET /api/consent-rules
 * Returns all state consent rules or requirements for a specific call
 */
export const GET = withAuth(async (request, context, user) => {
  const url = new URL(request.url);
  const orgState = url.searchParams.get("orgState");
  const clientAreaCode = url.searchParams.get("clientAreaCode") || undefined;

  // If orgState is provided, return requirements for that call scenario
  if (orgState) {
    const requirements = await getConsentRequirementsForCall({
      orgState,
      clientAreaCode,
    });

    return NextResponse.json({
      success: true,
      data: requirements,
    });
  }

  // Otherwise return all rules
  const rules = await getAllStateRules();

  return NextResponse.json({
    success: true,
    data: rules,
  });
});

/**
 * POST /api/consent-rules
 * Create or update a state consent rule (admin only)
 */
export const POST = withAuth(async (request, context, user) => {
  // Only admins can modify consent rules
  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only admins can modify consent rules" } },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const {
    stateCode,
    stateName,
    consentType,
    requiresExplicitOptIn,
    silenceImpliesConsent,
    minorAgeThreshold,
    additionalRules,
    effectiveDate,
    notes,
  } = body as {
    stateCode?: string;
    stateName?: string;
    consentType?: string;
    requiresExplicitOptIn?: boolean;
    silenceImpliesConsent?: boolean;
    minorAgeThreshold?: number;
    additionalRules?: Record<string, unknown>;
    effectiveDate?: string;
    notes?: string;
  };

  // Validate required fields
  if (!stateCode || !stateName) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "stateCode and stateName are required" } },
      { status: 400 }
    );
  }

  if (!consentType || !Object.values(StateConsentType).includes(consentType as StateConsentType)) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: `Invalid consentType. Must be one of: ${Object.values(StateConsentType).join(", ")}`,
        },
      },
      { status: 400 }
    );
  }

  if (!effectiveDate) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "effectiveDate is required" } },
      { status: 400 }
    );
  }

  const rule = await upsertStateRule({
    stateCode,
    stateName,
    consentType: consentType as StateConsentType,
    requiresExplicitOptIn,
    silenceImpliesConsent,
    minorAgeThreshold,
    additionalRules,
    effectiveDate: new Date(effectiveDate),
    notes,
  });

  return NextResponse.json({
    success: true,
    data: rule,
  });
});
