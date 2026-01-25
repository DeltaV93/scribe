import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { approveRequest, rejectRequest } from "@/lib/services/phone-requests";

/**
 * PATCH /api/admin/phone-requests/[id]
 * Approve or reject a phone number request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { action, poolNumberId, reason } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const result = await approveRequest(requestId, user.id, poolNumberId);
      return NextResponse.json({ data: result });
    } else {
      await rejectRequest(requestId, user.id, reason);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error processing phone request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}
