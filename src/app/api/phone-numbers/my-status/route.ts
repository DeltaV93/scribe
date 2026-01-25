import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPhoneNumber } from "@/lib/twilio/number-provisioning";
import { getUserPendingRequest } from "@/lib/services/phone-requests";

/**
 * GET /api/phone-numbers/my-status
 * Get the current user's phone number status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get assigned phone number
    const twilioNumber = await getUserPhoneNumber(user.id);

    // Get pending request (if no number assigned)
    let pendingRequest = null;
    if (!twilioNumber) {
      pendingRequest = await getUserPendingRequest(user.id);
    }

    return NextResponse.json({
      data: {
        phoneNumber: twilioNumber?.phoneNumber || null,
        areaCode: twilioNumber?.areaCode || null,
        hasPendingRequest: !!pendingRequest,
        requestId: pendingRequest?.id || null,
        requestedAt: pendingRequest?.requestedAt || null,
      },
    });
  } catch (error) {
    console.error("Error fetching phone status:", error);
    return NextResponse.json(
      { error: "Failed to fetch phone status" },
      { status: 500 }
    );
  }
}
