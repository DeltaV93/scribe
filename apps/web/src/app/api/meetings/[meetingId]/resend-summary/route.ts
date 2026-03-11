/**
 * Resend Meeting Summary API
 *
 * POST /api/meetings/[meetingId]/resend-summary - Resend summary email to recipients
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { resendSummaryEmail } from "@/lib/services/meetings";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Resend meeting summary email
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;
    const body = await request.json();

    if (!body.recipientEmails || !Array.isArray(body.recipientEmails) || body.recipientEmails.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "recipientEmails array is required" } },
        { status: 400 }
      );
    }

    const result = await resendSummaryEmail(
      meetingId,
      user.orgId,
      body.recipientEmails
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error resending summary email:", error);
    const message = error instanceof Error ? error.message : "Failed to resend summary email";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
