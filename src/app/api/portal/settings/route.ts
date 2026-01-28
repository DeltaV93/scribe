import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/services/portal-sessions";
import { hasPIN } from "@/lib/services/client-pin";
import { getClientSmsPreference } from "@/lib/services/sms-notifications";
import { getSessionFromCookie } from "@/lib/portal/cookies";

/**
 * GET /api/portal/settings - Get client's current settings
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = getSessionFromCookie(request);

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    // Get settings in parallel
    const [pinSet, smsPreference] = await Promise.all([
      hasPIN(session.clientId),
      getClientSmsPreference(session.clientId),
    ]);

    // Format phone for display (mask middle digits for privacy)
    const maskedPhone = session.client.phone.length === 10
      ? `(${session.client.phone.slice(0, 3)}) ***-${session.client.phone.slice(-4)}`
      : session.client.phone;

    return NextResponse.json({
      success: true,
      data: {
        phone: session.client.phone,
        phoneDisplay: maskedPhone,
        smsOptedIn: smsPreference?.optedIn || false,
        hasPIN: pinSet,
      },
    });
  } catch (error) {
    console.error("Error fetching portal settings:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch settings" } },
      { status: 500 }
    );
  }
}
