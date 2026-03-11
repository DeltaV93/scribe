import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin, canManageForms } from "@/lib/auth";
import {
  getPendingApprovals,
  countPendingApprovals,
} from "@/lib/services/note-approvals";

/**
 * GET /api/admin/note-approvals
 * List pending shareable notes for approval
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow admin and program managers to view approvals
    if (!isAdmin(user) && !canManageForms(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await countPendingApprovals(user.orgId);
      return NextResponse.json({ data: { count } });
    }

    const pendingNotes = await getPendingApprovals(user.orgId);

    return NextResponse.json({ data: pendingNotes });
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending approvals" },
      { status: 500 }
    );
  }
}
