import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { releasePoolNumber } from "@/lib/services/phone-number-management";

/**
 * DELETE /api/admin/phone-numbers/pool/[id]
 * Release a number from the pool back to Twilio
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

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await releasePoolNumber(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error releasing pool number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to release number" },
      { status: 500 }
    );
  }
}
