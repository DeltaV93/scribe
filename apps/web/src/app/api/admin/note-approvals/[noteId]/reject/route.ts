import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin, canManageForms } from "@/lib/auth";
import {
  rejectNote,
  RejectionReason,
  REJECTION_REASON_LABELS,
} from "@/lib/services/note-approvals";
import { createAuditLog } from "@/lib/audit/service";

// Valid rejection reasons
const VALID_REASONS = Object.keys(REJECTION_REASON_LABELS) as RejectionReason[];

/**
 * POST /api/admin/note-approvals/[noteId]/reject
 * Reject a shareable note with a reason
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

    // Allow admin and program managers to reject
    if (!isAdmin(user) && !canManageForms(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { noteId } = await params;
    const body = await request.json();
    const { reason, customFeedback } = body;

    // Validate reason
    if (!reason || !VALID_REASONS.includes(reason as RejectionReason)) {
      return NextResponse.json(
        {
          error: "Invalid rejection reason",
          validReasons: VALID_REASONS,
        },
        { status: 400 }
      );
    }

    // Require custom feedback for "OTHER" reason
    if (reason === "OTHER" && !customFeedback?.trim()) {
      return NextResponse.json(
        { error: "Custom feedback is required when reason is OTHER" },
        { status: 400 }
      );
    }

    const result = await rejectNote(
      noteId,
      user.id,
      user.orgId,
      reason as RejectionReason,
      customFeedback?.trim()
    );

    // Audit log the rejection
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "REJECT",
      resource: "NOTE",
      resourceId: noteId,
      details: {
        clientId: result.note.client.id,
        authorId: result.note.author.id,
        rejectionReason: reason,
        customFeedback: customFeedback?.trim(),
      },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error rejecting note:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject note" },
      { status: 500 }
    );
  }
}
