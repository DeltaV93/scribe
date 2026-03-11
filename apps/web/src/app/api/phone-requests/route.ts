import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPhoneRequest } from "@/lib/services/phone-requests";

/**
 * POST /api/phone-requests
 * Create a phone number request (case manager submits request)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const phoneRequest = await createPhoneRequest(user.id, user.orgId);

    return NextResponse.json({ data: phoneRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating phone request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create request" },
      { status: 500 }
    );
  }
}
