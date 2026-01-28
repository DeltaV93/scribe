import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/services/portal-sessions";
import { initiatePhoneChange, isValidPhoneFormat } from "@/lib/services/phone-verification";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse } from "@/lib/portal/csrf";

const phoneSchema = z.object({
  phone: z.string().min(10).max(15),
});

/**
 * PUT /api/portal/settings/phone - Initiate phone number change
 *
 * Sends a verification code to the new phone number.
 * The actual change happens after verifying the code.
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
    const validation = phoneSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid phone number format",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { phone } = validation.data;

    if (!isValidPhoneFormat(phone)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Please enter a valid 10-digit phone number",
          },
        },
        { status: 400 }
      );
    }

    // Initiate phone change (sends verification SMS)
    const result = await initiatePhoneChange(session.clientId, phone);

    return NextResponse.json({
      success: true,
      data: {
        verificationId: result.verificationId,
        expiresAt: result.expiresAt,
        message: "Verification code sent to your new phone number",
      },
    });
  } catch (error) {
    console.error("Error initiating phone change:", error);

    const message = error instanceof Error ? error.message : "Failed to initiate phone change";

    // Check for specific error types
    if (message.includes("already associated")) {
      return NextResponse.json(
        { error: { code: "PHONE_IN_USE", message } },
        { status: 400 }
      );
    }

    if (message.includes("different from current")) {
      return NextResponse.json(
        { error: { code: "SAME_PHONE", message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
