import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listAvailableCaseManagers, getCaseloadStatistics } from "@/lib/services/client-matching";
import { UserRole } from "@/types";
import { z } from "zod";

const querySchema = z.object({
  includeUnavailable: z.enum(["true", "false"]).optional().default("false"),
  includeFull: z.enum(["true", "false"]).optional().default("false"),
  includeStats: z.enum(["true", "false"]).optional().default("false"),
});

/**
 * GET /api/case-managers/availability
 * List available case managers with their caseload info
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can view all case managers
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view case manager availability" } },
        { status: 403 }
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

    const { includeUnavailable, includeFull, includeStats } = validation.data;

    // Get available case managers
    const caseManagers = await listAvailableCaseManagers(user.orgId, {
      includeUnavailable: includeUnavailable === "true",
      includeFull: includeFull === "true",
    });

    // Optionally include statistics
    let stats = null;
    if (includeStats === "true") {
      stats = await getCaseloadStatistics(user.orgId);
    }

    return NextResponse.json({
      success: true,
      data: {
        caseManagers: caseManagers.map((cm) => ({
          id: cm.id,
          name: cm.name,
          email: cm.email,
          role: cm.role,
          profile: cm.caseManagerProfile
            ? {
                maxCaseload: cm.caseManagerProfile.maxCaseload,
                currentCaseload: cm.caseManagerProfile.currentCaseload,
                availabilityStatus: cm.caseManagerProfile.availabilityStatus,
                availabilityNote: cm.caseManagerProfile.availabilityNote,
                languages: cm.caseManagerProfile.languages,
                skills: cm.caseManagerProfile.skills,
                specializations: cm.caseManagerProfile.specializations,
                preferredClientTypes: cm.caseManagerProfile.preferredClientTypes,
                spotsAvailable:
                  cm.caseManagerProfile.maxCaseload - cm.caseManagerProfile.currentCaseload,
              }
            : {
                maxCaseload: 30,
                currentCaseload: 0,
                availabilityStatus: "AVAILABLE",
                availabilityNote: null,
                languages: ["English"],
                skills: [],
                specializations: [],
                preferredClientTypes: [],
                spotsAvailable: 30,
              },
        })),
        ...(stats && {
          statistics: {
            totalCaseManagers: stats.total,
            available: stats.available,
            atCapacity: stats.atCapacity,
            unavailable: stats.unavailable,
            averageLoad: stats.averageLoad,
          },
        }),
      },
    });
  } catch (error) {
    console.error("Error getting case manager availability:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get case manager availability" } },
      { status: 500 }
    );
  }
}
