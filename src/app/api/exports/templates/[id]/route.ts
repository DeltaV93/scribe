/**
 * Export Template API - Single Template
 *
 * GET /api/exports/templates/[id] - Get template
 * PUT /api/exports/templates/[id] - Update template
 * DELETE /api/exports/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import {
  getTemplate,
  updateTemplate,
  activateTemplate,
  archiveTemplate,
  deleteTemplate,
} from "@/lib/services/exports/templates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const template = await getTemplate(id, dbUser.orgId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error getting template:", error);
    return NextResponse.json(
      { error: "Failed to get template" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins and program managers can update templates
    if (!["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    let result;

    // Handle special actions
    if (action === "activate") {
      result = await activateTemplate(id, dbUser.orgId);
    } else if (action === "archive") {
      result = await archiveTemplate(id, dbUser.orgId);
    } else {
      // Regular update
      result = await updateTemplate(id, dbUser.orgId, updateData);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating template:", error);
    const message = error instanceof Error ? error.message : "Failed to update template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins can delete templates
    if (!["ADMIN", "SUPER_ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const hardDelete = searchParams.get("hard") === "true";

    const result = await deleteTemplate(id, dbUser.orgId, hardDelete);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting template:", error);
    const message = error instanceof Error ? error.message : "Failed to delete template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
