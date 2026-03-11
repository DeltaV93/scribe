import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { z } from "zod";

// Custom signals validation
const customSignalsSchema = z.object({
  keywords: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  weights: z.record(z.number()).optional(),
});

// Matching rules validation
const matchingRulesSchema = z.object({
  overrides: z.array(z.record(z.unknown())).optional(),
  weights: z.record(z.number()).optional(),
  disabled_rules: z.array(z.string()).optional(),
});

// Industry enum values
const industryValues = [
  "nonprofit",
  "healthcare",
  "tech",
  "legal",
  "sales",
  "education",
  "government",
  "finance",
  "other",
] as const;

// Company type enum values
const companyTypeValues = [
  "startup",
  "enterprise",
  "nonprofit",
  "government",
  "agency",
  "consulting",
] as const;

// Model tier enum values
const modelTierValues = ["shared", "private"] as const;

// Validation schema for updating org profile
const updateOrgProfileSchema = z.object({
  // Industry & classification (PX-889)
  industry: z.enum(industryValues).nullable().optional(),
  secondary_industry: z.enum(industryValues).nullable().optional(),
  company_type: z.enum(companyTypeValues).nullable().optional(),
  team_roles: z.array(z.string()).optional(),

  // Model configuration (PX-889)
  model_tier: z.enum(modelTierValues).optional(),
  data_sharing_consent: z.boolean().optional(),

  // Custom signals & matching (PX-889)
  custom_signals: customSignalsSchema.optional(),
  matching_rules: matchingRulesSchema.optional(),
  risk_overrides: z.record(z.string()).optional(),

  // Compliance & privacy (existing)
  compliance_frameworks: z.array(z.string()).optional(),
  retention_policies: z.record(z.string()).optional(),
  privacy_settings: z.record(z.unknown()).optional(),
  epsilon_budget: z.number().positive().optional(),
  model_training_enabled: z.boolean().optional(),
  audit_routing_config: z.record(z.unknown()).optional(),
});

/**
 * GET /api/ml/org/profile - Get the organization's ML profile
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const profile = await mlServices.orgProfile.get(user.orgId);

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("Error getting org profile:", error);

    if (error instanceof MLServiceApiError) {
      // If profile doesn't exist, return a helpful message
      if (error.code === "ORG_PROFILE_NOT_FOUND") {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Organization ML profile not found. Create one to get started.",
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get org profile" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ml/org/profile - Update or create the organization's ML profile
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = updateOrgProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid profile data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Convert validated data to match API types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = validation.data as any;

    // Try to update existing profile, or create if it doesn't exist
    let profile;
    try {
      profile = await mlServices.orgProfile.update(user.orgId, updateData);
    } catch (error) {
      if (error instanceof MLServiceApiError && error.code === "ORG_PROFILE_NOT_FOUND") {
        // Profile doesn't exist, create it
        profile = await mlServices.orgProfile.create(user.orgId, updateData);
      } else {
        throw error;
      }
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("Error updating org profile:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update org profile" } },
      { status: 500 }
    );
  }
}
