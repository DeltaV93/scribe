import { NextRequest, NextResponse } from "next/server";
import { verifyApprovalToken } from "@/lib/services/waitlist";

/**
 * GET /api/waitlist/verify/:token
 * Verify an approval token for account creation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length !== 64) {
      return NextResponse.json(
        { valid: false, reason: "not_found" },
        { status: 404 }
      );
    }

    const result = await verifyApprovalToken(token);

    if (!result.valid) {
      const statusCode = result.reason === "expired" ? 410 : 404;
      return NextResponse.json(
        {
          valid: false,
          reason: result.reason,
          message:
            result.reason === "expired"
              ? "This link has expired. Please contact us for a new one."
              : result.reason === "used"
              ? "This link has already been used."
              : "Invalid link.",
        },
        { status: statusCode }
      );
    }

    // Return user info for pre-filling form
    return NextResponse.json({
      valid: true,
      email: result.entry!.email,
      firstName: result.entry!.firstName,
      lastName: result.entry!.lastName,
      organization: result.entry!.organization,
    });
  } catch (error) {
    console.error("Error verifying waitlist token:", error);
    return NextResponse.json(
      { valid: false, reason: "error" },
      { status: 500 }
    );
  }
}
