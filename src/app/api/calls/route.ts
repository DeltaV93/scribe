import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { initiateCall, listCalls, getCaseManagerCalls } from "@/lib/services/calls";
import { getConsentStatus } from "@/lib/services/consent";
import { UserRole } from "@/types";
import { CallStatus, ConsentType, ConsentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * GET /api/calls - List calls
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as CallStatus | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (clientId) filters.clientId = clientId;

    // Case managers only see their own calls
    let result;
    if (user.role === UserRole.CASE_MANAGER) {
      result = await getCaseManagerCalls(
        user.id,
        user.orgId,
        filters,
        { page, limit }
      );
    } else {
      result = await listCalls(user.orgId, filters, { page, limit });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error listing calls:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list calls" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls - Initiate a new call
 *
 * Returns consent status along with call data:
 * - consentStatus: GRANTED | REVOKED | PENDING
 * - warning: Present if consent is REVOKED (client previously opted out)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { clientId, formIds } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Client ID is required" } },
        { status: 400 }
      );
    }

    // Check consent status before initiating call (PX-735)
    const consentResult = await getConsentStatus(clientId, ConsentType.RECORDING);

    // Get client name for warning message
    let clientName = "this client";
    if (consentResult.status === ConsentStatus.REVOKED) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { firstName: true, lastName: true },
      });
      if (client) {
        clientName = `${client.firstName} ${client.lastName}`;
      }
    }

    // initiateCall uses a serializable transaction to prevent race conditions
    // It will return an existing active call if one exists
    const call = await initiateCall({
      clientId,
      caseManagerId: user.id,
      formIds: formIds || [],
      orgId: user.orgId,
    });

    // Build response with consent info
    const response: {
      success: boolean;
      data: typeof call;
      consentStatus: ConsentStatus;
      needsConsentPrompt: boolean;
      warning?: {
        type: string;
        message: string;
        clientName: string;
        revokedAt?: string;
      };
    } = {
      success: true,
      data: call,
      consentStatus: consentResult.status,
      needsConsentPrompt: consentResult.status === ConsentStatus.PENDING,
    };

    // Add warning if consent was revoked
    if (consentResult.status === ConsentStatus.REVOKED) {
      response.warning = {
        type: "CONSENT_REVOKED",
        message: `${clientName} has opted out of recording. This call will not be recorded.`,
        clientName,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error initiating call:", error);

    if (error instanceof Error && error.message === "Client not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to initiate call" } },
      { status: 500 }
    );
  }
}
