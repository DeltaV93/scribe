import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/services/portal-tokens";
import { z } from "zod";

const validateTokenSchema = z.object({
  token: z.string().length(64),
});

/**
 * POST /api/portal/validate - Validate a portal magic link token
 *
 * Returns client session info if valid, error if expired/invalid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateTokenSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid token format",
          },
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    const session = await getPortalSession(token);

    if (!session.isValid) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: session.error || "Invalid or expired token",
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        client: {
          id: session.client!.id,
          firstName: session.client!.firstName,
          lastName: session.client!.lastName,
          organization: session.client!.organization.name,
        },
        messageId: session.messageId,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error validating portal token:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to validate token" } },
      { status: 500 }
    );
  }
}
