import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * POST /api/auth/sync-user
 *
 * Syncs the current Supabase auth user to the database.
 * Creates organization and user if they don't exist.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
    });

    if (existingUser) {
      return NextResponse.json({
        message: "User already exists",
        user: existingUser,
      });
    }

    // Get user metadata from Supabase
    const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User";
    const organizationName = authUser.user_metadata?.organizationName || `${name}'s Organization`;

    // Generate org slug
    const baseSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let orgSlug = baseSlug;
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      orgSlug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    // Create organization and user
    const org = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: orgSlug,
        users: {
          create: {
            email: authUser.email!,
            name,
            supabaseUserId: authUser.id,
            role: UserRole.ADMIN,
            canCreateForms: true,
            canReadForms: true,
            canUpdateForms: true,
            canDeleteForms: true,
            canPublishForms: true,
          },
        },
      },
      include: {
        users: true,
      },
    });

    return NextResponse.json({
      message: "User synced successfully",
      organization: org.name,
      user: org.users[0],
    });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json(
      { error: "Failed to sync user", details: String(error) },
      { status: 500 }
    );
  }
}
