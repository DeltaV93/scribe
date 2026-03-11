import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelRequest } from "@/lib/services/phone-requests";

/**
 * DELETE /api/phone-requests/[id]
 * Cancel a phone number request (user cancels their own request)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requestId } = await params;

    await cancelRequest(requestId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error canceling phone request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel request" },
      { status: 500 }
    );
  }
}
