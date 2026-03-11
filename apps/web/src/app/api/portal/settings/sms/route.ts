import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/services/portal-sessions";
import { updateSmsPreference, formatPhoneToE164 } from "@/lib/services/sms-notifications";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse } from "@/lib/portal/csrf";

const smsSchema = z.object({
  optedIn: z.boolean(),
});

/**
 * PUT /api/portal/settings/sms - Update SMS notification preference
 */
export async function PUT(request: NextRequest) {
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

    // Validate CSRF
    if (!validateCSRF(request, session.csrfToken)) {
      return createCSRFErrorResponse();
    }

    const body = await request.json();
    const validation = smsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid SMS preference",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { optedIn } = validation.data;

    // Update SMS preference
    await updateSmsPreference(session.clientId, {
      optedIn,
      phoneNumber: formatPhoneToE164(session.client.phone),
      optInMethod: "portal",
    });

    return NextResponse.json({
      success: true,
      data: {
        smsOptedIn: optedIn,
      },
      message: optedIn
        ? "You will now receive SMS notifications"
        : "SMS notifications have been disabled",
    });
  } catch (error) {
    console.error("Error updating SMS preference:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update SMS preference" } },
      { status: 500 }
    );
  }
}
