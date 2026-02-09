import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin, canManageForms } from "@/lib/auth";
import { approveNote } from "@/lib/services/note-approvals";
import { createAuditLog } from "@/lib/audit/service";

/**
 * POST /api/admin/note-approvals/[noteId]/approve
 * Approve a shareable note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow admin and program managers to approve
    if (!isAdmin(user) && !canManageForms(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { noteId } = await params;

    const result = await approveNote(noteId, user.id, user.orgId);

    // Audit log the approval
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "APPROVE",
      resource: "NOTE",
      resourceId: noteId,
      details: {
        clientId: result.note.client.id,
        authorId: result.note.author.id,
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error approving note:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve note" },
      { status: 500 }
    );
  }
}
