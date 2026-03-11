import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/services/portal-sessions";
import { verifyPhoneChange } from "@/lib/services/phone-verification";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse } from "@/lib/portal/csrf";

const verifySchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
});

/**
 * POST /api/portal/settings/phone/verify - Complete phone number change
 *
 * Verifies the code sent to the new phone number and updates the client's phone.
 * Note: This will invalidate all existing sessions (including the current one).
 */
export async function POST(request: NextRequest) {
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
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid verification data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { verificationId, code } = validation.data;

    const result = await verifyPhoneChange(session.clientId, verificationId, code);

    if (!result.success) {
      const response: {
        error: {
          code: string;
          message: string;
          remainingAttempts?: number;
        };
      } = {
        error: {
          code: "VERIFICATION_FAILED",
          message: result.error || "Verification failed",
        },
      };

      if (result.remainingAttempts !== undefined) {
        response.error.remainingAttempts = result.remainingAttempts;
      }

      return NextResponse.json(response, { status: 400 });
    }

    // Phone changed successfully
    // Note: All sessions have been invalidated, including this one
    // Client will need to re-authenticate with a new magic link
    return NextResponse.json({
      success: true,
      message: "Phone number updated successfully. Please sign in again with your new number.",
      requiresReauth: true,
    });
  } catch (error) {
    console.error("Error verifying phone change:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to verify phone change" } },
      { status: 500 }
    );
  }
}
