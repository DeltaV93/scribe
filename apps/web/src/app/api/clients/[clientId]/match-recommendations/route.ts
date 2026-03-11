import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMatchRecommendations } from "@/lib/services/client-matching";
import { getClientById } from "@/lib/services/clients";
import { UserRole } from "@/types";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(5),
  excludeUnavailable: z.enum(["true", "false"]).optional().default("true"),
  excludeFullCaseload: z.enum(["true", "false"]).optional().default("true"),
  requiredLanguages: z.string().optional(),
  requiredSkills: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/match-recommendations
 * Get recommended case managers for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Only admins and program managers can view match recommendations
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view match recommendations" } },
        { status: 403 }
      );
    }

    // Verify client exists
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { limit, excludeUnavailable, excludeFullCaseload, requiredLanguages, requiredSkills } =
      validation.data;

    // Get recommendations
    const recommendations = await getMatchRecommendations(clientId, user.orgId, limit, {
      excludeUnavailable: excludeUnavailable === "true",
      excludeFullCaseload: excludeFullCaseload === "true",
      requiredLanguages: requiredLanguages ? requiredLanguages.split(",").map((s) => s.trim()) : undefined,
      requiredSkills: requiredSkills ? requiredSkills.split(",").map((s) => s.trim()) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        clientId,
        clientName: `${client.firstName} ${client.lastName}`,
        recommendations: recommendations.map((rec) => ({
          caseManager: {
            id: rec.caseManager.id,
            name: rec.caseManager.name,
            email: rec.caseManager.email,
            role: rec.caseManager.role,
            profile: rec.caseManager.caseManagerProfile
              ? {
                  maxCaseload: rec.caseManager.caseManagerProfile.maxCaseload,
                  currentCaseload: rec.caseManager.caseManagerProfile.currentCaseload,
                  availabilityStatus: rec.caseManager.caseManagerProfile.availabilityStatus,
                  languages: rec.caseManager.caseManagerProfile.languages,
                  skills: rec.caseManager.caseManagerProfile.skills,
                  specializations: rec.caseManager.caseManagerProfile.specializations,
                }
              : null,
          },
          score: rec.score,
          scoreBreakdown: rec.scoreBreakdown,
          reasons: rec.reasons,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting match recommendations:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get match recommendations" } },
      { status: 500 }
    );
  }
}
