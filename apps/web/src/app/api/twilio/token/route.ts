import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateTokenResponse } from "@/lib/twilio/capability-token";
import { isTwilioConfigured } from "@/lib/twilio/client";

/**
 * GET /api/twilio/token - Get a Twilio access token for WebRTC
 */
export async function GET() {
  try {
    const user = await requireAuth();

    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Twilio is not configured" } },
        { status: 503 }
      );
    }

    const tokenData = generateTokenResponse(user.id);

    return NextResponse.json({
      success: true,
      data: tokenData,
    });
  } catch (error) {
    console.error("Error generating Twilio token:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate token" } },
      { status: 500 }
    );
  }
}
