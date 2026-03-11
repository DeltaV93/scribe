import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createRecording,
  listRecordings,
} from "@/lib/services/in-person-recording";
import { ConsentMethod, ProcessingStatus } from "@prisma/client";

/**
 * GET /api/in-person-recordings - List in-person recordings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const clientId = searchParams.get("clientId") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const status = searchParams.get("status") as ProcessingStatus | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const result = await listRecordings(
      user.orgId,
      {
        clientId,
        userId,
        status: status || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result.recordings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing in-person recordings:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list recordings" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/in-person-recordings - Create a new in-person recording with consent
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const {
      clientId,
      consentMethod,
      consentSignature,
      consentDocumentId,
      formIds,
    } = body;

    // Validate required fields
    if (!clientId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Client ID is required" } },
        { status: 400 }
      );
    }

    if (!consentMethod || !["DIGITAL", "VERBAL", "PRE_SIGNED"].includes(consentMethod)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid consent method is required (DIGITAL, VERBAL, or PRE_SIGNED)" } },
        { status: 400 }
      );
    }

    // Validate consent-specific requirements
    if (consentMethod === "DIGITAL" && !consentSignature) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Digital signature is required for DIGITAL consent" } },
        { status: 400 }
      );
    }

    if (consentMethod === "PRE_SIGNED" && !consentDocumentId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Consent document ID is required for PRE_SIGNED consent" } },
        { status: 400 }
      );
    }

    const recording = await createRecording({
      organizationId: user.orgId,
      clientId,
      userId: user.id,
      consentMethod: consentMethod as ConsentMethod,
      consentSignature,
      consentDocumentId,
      formIds: formIds || [],
    });

    return NextResponse.json({
      success: true,
      data: recording,
    });
  } catch (error) {
    console.error("Error creating in-person recording:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("not enabled")) {
        return NextResponse.json(
          { error: { code: "FEATURE_DISABLED", message: error.message } },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create recording" } },
      { status: 500 }
    );
  }
}
