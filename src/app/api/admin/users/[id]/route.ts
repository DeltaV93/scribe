import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getUserById,
  updateUser,
  deleteUser,
} from "@/lib/services/user-management";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { notifyUserOfRoleChange } from "@/lib/services/email-notifications";
import { UserRole } from "@prisma/client";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  teamId: z.string().uuid().nullable().optional(),
  maxCaseload: z.number().int().positive().nullable().optional(),
});

/**
 * GET /api/admin/users/[id]
 * Get a single user's details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const user = await getUserById(id, currentUser.orgId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update a user's details
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Get current user state for comparison
    const existingUser = await getUserById(id, currentUser.orgId);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData = validation.data;
    const updatedUser = await updateUser(id, currentUser.orgId, updateData);

    // Log appropriate actions based on what changed
    if (updateData.role && updateData.role !== existingUser.role) {
      await logUserManagementAction({
        action: "USER_ROLE_CHANGED",
        actorId: currentUser.id,
        orgId: currentUser.orgId,
        targetUserId: id,
        targetEmail: existingUser.email,
        targetName: existingUser.name || undefined,
        details: {
          previousRole: existingUser.role,
          newRole: updateData.role,
        },
      });

      // Notify user of role change
      await notifyUserOfRoleChange(existingUser.email, {
        userName: existingUser.name || existingUser.email,
        oldRole: formatRole(existingUser.role),
        newRole: formatRole(updateData.role),
        changedByName: currentUser.name || "An administrator",
      });
    }

    if (updateData.teamId !== undefined) {
      const oldTeam = existingUser.teamMemberships[0]?.team;
      const newTeam = updatedUser.teamMemberships[0]?.team;

      if (oldTeam?.id !== newTeam?.id) {
        await logUserManagementAction({
          action: "USER_TEAM_CHANGED",
          actorId: currentUser.id,
          orgId: currentUser.orgId,
          targetUserId: id,
          targetEmail: existingUser.email,
          targetName: existingUser.name || undefined,
          details: {
            previousTeam: oldTeam?.name || null,
            newTeam: newTeam?.name || null,
          },
        });
      }
    }

    if (updateData.name || updateData.maxCaseload !== undefined) {
      await logUserManagementAction({
        action: "USER_DETAILS_UPDATED",
        actorId: currentUser.id,
        orgId: currentUser.orgId,
        targetUserId: id,
        targetEmail: existingUser.email,
        targetName: existingUser.name || undefined,
        details: {
          changes: Object.keys(updateData).filter(
            (k) => k !== "role" && k !== "teamId"
          ),
        },
      });
    }

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently delete a user
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get user info before deletion for logging
    const existingUser = await getUserById(id, currentUser.orgId);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await deleteUser(id, currentUser.orgId, currentUser.id);

    // Log the action
    await logUserManagementAction({
      action: "USER_DELETED",
      actorId: currentUser.id,
      orgId: currentUser.orgId,
      targetUserId: id,
      targetEmail: existingUser.email,
      targetName: existingUser.name || undefined,
      details: {
        deletedUserRole: existingUser.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

function formatRole(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrator",
    PROGRAM_MANAGER: "Program Manager",
    CASE_MANAGER: "Case Manager",
    VIEWER: "Viewer",
  };
  return roleNames[role] || role;
}
