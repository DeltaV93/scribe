import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/services/portal-sessions";
import { verifyPIN } from "@/lib/services/client-pin";
import { getSessionFromCookie } from "@/lib/portal/cookies";

const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

/**
 * POST /api/portal/pin/verify - Verify client PIN
 *
 * This is used when a client returns to an existing session and needs
 * to verify their PIN before accessing protected content.
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

    const body = await request.json();
    const validation = verifyPinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "PIN must be exactly 4 digits",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { pin } = validation.data;
    const result = await verifyPIN(session.clientId, pin);

    if (!result.success) {
      const response: {
        error: {
          code: string;
          message: string;
          remainingAttempts?: number;
          lockedUntil?: string;
        };
      } = {
        error: {
          code: result.lockedUntil ? "ACCOUNT_LOCKED" : "INVALID_PIN",
          message: result.error || "Verification failed",
        },
      };

      if (result.remainingAttempts !== undefined) {
        response.error.remainingAttempts = result.remainingAttempts;
      }

      if (result.lockedUntil) {
        response.error.lockedUntil = result.lockedUntil.toISOString();
      }

      return NextResponse.json(response, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: "PIN verified successfully",
    });
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to verify PIN" } },
      { status: 500 }
    );
  }
}
