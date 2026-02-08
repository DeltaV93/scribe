import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateTokenResponse } from "@/lib/twilio/capability-token";

/**
 * GET /api/voice/token - Get a Twilio access token for browser-based calling
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Generate token with user's ID as identity
    // This allows Twilio to route incoming calls to the correct user
    const tokenData = generateTokenResponse(user.id);

    return NextResponse.json({
      success: true,
      data: tokenData,
    });
  } catch (error) {
    console.error("Error generating voice token:", error);

    // Check if it's a config error
    if (error instanceof Error && error.message.includes("configuration")) {
      return NextResponse.json(
        {
          error: {
            code: "CONFIG_ERROR",
            message: "Voice calling is not configured",
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate voice token",
        },
      },
      { status: 500 }
    );
  }
}
