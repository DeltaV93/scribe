import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getCaseManagerProfile,
  getOrCreateCaseManagerProfile,
  updateCaseManagerProfile,
  syncCaseloadCount,
} from "@/lib/services/client-matching";
import { UserRole } from "@/types";
import { AvailabilityStatus } from "@prisma/client";
import { z } from "zod";

const updateProfileSchema = z.object({
  maxCaseload: z.number().min(0).max(200).optional(),
  skills: z.array(z.string().min(1).max(100)).max(50).optional(),
  languages: z.array(z.string().min(1).max(100)).max(20).optional(),
  specializations: z.array(z.string().min(1).max(100)).max(20).optional(),
  availabilityStatus: z.nativeEnum(AvailabilityStatus).optional(),
  availabilityNote: z.string().max(500).nullable().optional(),
  preferredClientTypes: z.array(z.string().min(1).max(100)).max(20).optional(),
});

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/case-managers/:userId/profile
 * Get a case manager's profile
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { userId } = await context.params;

    // Users can view their own profile, admins/program managers can view any
    const canView =
      userId === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canView) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this profile" } },
        { status: 403 }
      );
    }

    // Get or create profile
    let profile = await getCaseManagerProfile(userId, user.orgId);

    if (!profile) {
      // Try to create one if it doesn't exist
      try {
        profile = await getOrCreateCaseManagerProfile(userId, user.orgId);
      } catch {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "User not found" } },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        maxCaseload: profile.maxCaseload,
        currentCaseload: profile.currentCaseload,
        spotsAvailable: profile.maxCaseload - profile.currentCaseload,
        skills: profile.skills,
        languages: profile.languages,
        specializations: profile.specializations,
        availabilityStatus: profile.availabilityStatus,
        availabilityNote: profile.availabilityNote,
        preferredClientTypes: profile.preferredClientTypes,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting case manager profile:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get case manager profile" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/case-managers/:userId/profile
 * Update a case manager's profile
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { userId } = await context.params;

    // Users can update their own profile, admins/program managers can update any
    const canUpdate =
      userId === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canUpdate) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update this profile" } },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

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

    // Update profile
    const profile = await updateCaseManagerProfile(userId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        userId,
        maxCaseload: profile.maxCaseload,
        currentCaseload: profile.currentCaseload,
        spotsAvailable: profile.maxCaseload - profile.currentCaseload,
        skills: profile.skills,
        languages: profile.languages,
        specializations: profile.specializations,
        availabilityStatus: profile.availabilityStatus,
        availabilityNote: profile.availabilityNote,
        preferredClientTypes: profile.preferredClientTypes,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating case manager profile:", error);

    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update case manager profile" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/case-managers/:userId/profile/sync
 * Sync caseload count for a case manager
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { userId } = await context.params;

    // Only admins can sync caseload counts
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to sync caseload counts" } },
        { status: 403 }
      );
    }

    const currentCaseload = await syncCaseloadCount(userId);

    return NextResponse.json({
      success: true,
      message: "Caseload count synced successfully",
      data: {
        userId,
        currentCaseload,
      },
    });
  } catch (error) {
    console.error("Error syncing caseload count:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to sync caseload count" } },
      { status: 500 }
    );
  }
}
