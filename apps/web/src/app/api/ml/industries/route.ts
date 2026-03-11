import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

/**
 * GET /api/ml/industries - List available industry configurations
 */
export async function GET() {
  try {
    await requireAuth();

    const response = await mlServices.industries.list();

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error listing industries:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list industries" } },
      { status: 500 }
    );
  }
}
