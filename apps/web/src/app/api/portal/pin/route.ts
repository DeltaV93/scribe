import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/services/portal-sessions";
import { setPIN, removePIN, isValidPINFormat } from "@/lib/services/client-pin";
import { getSessionFromCookie } from "@/lib/portal/cookies";
import { validateCSRF, createCSRFErrorResponse, requiresCSRFValidation } from "@/lib/portal/csrf";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

/**
 * Helper to validate session and CSRF
 */
async function validateRequest(request: NextRequest): Promise<{
  valid: boolean;
  session?: Awaited<ReturnType<typeof validateSession>>;
  error?: Response;
}> {
  const sessionToken = getSessionFromCookie(request);

  if (!sessionToken) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      ),
    };
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      ),
    };
  }

  // Validate CSRF for state-changing requests
  if (requiresCSRFValidation(request.method)) {
    if (!validateCSRF(request, session.csrfToken)) {
      return {
        valid: false,
        error: createCSRFErrorResponse() as NextResponse,
      };
    }
  }

  return { valid: true, session };
}

/**
 * POST /api/portal/pin - Set or update client PIN
 */
export async function POST(request: NextRequest) {
  try {
    const { valid, session, error } = await validateRequest(request);
    if (!valid || !session) return error!;

    const body = await request.json();
    const validation = pinSchema.safeParse(body);

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

    if (!isValidPINFormat(pin)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "PIN must be exactly 4 digits",
          },
        },
        { status: 400 }
      );
    }

    await setPIN(session.clientId, pin);

    return NextResponse.json({
      success: true,
      message: "PIN has been set successfully",
    });
  } catch (error) {
    console.error("Error setting PIN:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to set PIN" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portal/pin - Remove client PIN
 */
export async function DELETE(request: NextRequest) {
  try {
    const { valid, session, error } = await validateRequest(request);
    if (!valid || !session) return error!;

    await removePIN(session.clientId);

    return NextResponse.json({
      success: true,
      message: "PIN has been removed",
    });
  } catch (error) {
    console.error("Error removing PIN:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove PIN" } },
      { status: 500 }
    );
  }
}
