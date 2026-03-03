import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { z } from "zod";

// Validation schema for updating org profile
const updateOrgProfileSchema = z.object({
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

    // Try to update existing profile, or create if it doesn't exist
    let profile;
    try {
      profile = await mlServices.orgProfile.update(user.orgId, validation.data);
    } catch (error) {
      if (error instanceof MLServiceApiError && error.code === "ORG_PROFILE_NOT_FOUND") {
        // Profile doesn't exist, create it
        profile = await mlServices.orgProfile.create(user.orgId, validation.data);
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
