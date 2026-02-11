/**
 * Client Consent API (PX-735)
 * GET: Get all consent records for a client
 * POST: Grant consent
 * DELETE: Revoke consent
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit } from "@/lib/auth/with-auth-audit";
import {
  getAllConsentRecords,
  grantConsent,
  revokeConsent,
  getConsentStatus,
  markRecordingsForDeletion,
} from "@/lib/services/consent";
import { logConsentActivity } from "@/lib/services/client-activity";
import { prisma } from "@/lib/db";
import { ConsentType, ConsentCollectionMethod } from "@prisma/client";

/**
 * GET /api/clients/[clientId]/consent
 * Returns all consent records for a client
 */
export const GET = withAuthAndAudit(
  async (request, context, user) => {
    const params = await context.params;
    const clientId = params.clientId;

    // Verify client exists and belongs to user's org
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { orgId: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    if (client.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const records = await getAllConsentRecords(clientId);

    return NextResponse.json({
      success: true,
      data: records,
    });
  },
  {
    action: "VIEW",
    resource: "CLIENT",
  }
);

/**
 * POST /api/clients/[clientId]/consent
 * Grant consent for a client
 */
export const POST = withAuthAndAudit(
  async (request, context, user) => {
    const params = await context.params;
    const clientId = params.clientId;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const { consentType, method, callId } = body as {
      consentType?: string;
      method?: string;
      callId?: string;
    };

    // Validate consent type
    if (!consentType || !Object.values(ConsentType).includes(consentType as ConsentType)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: `Invalid consentType. Must be one of: ${Object.values(ConsentType).join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Validate method
    if (!method || !Object.values(ConsentCollectionMethod).includes(method as ConsentCollectionMethod)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: `Invalid method. Must be one of: ${Object.values(ConsentCollectionMethod).join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Verify client exists and belongs to user's org
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { orgId: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    if (client.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    await grantConsent({
      clientId,
      consentType: consentType as ConsentType,
      method: method as ConsentCollectionMethod,
      callId,
    });

    // Log to activity feed
    await logConsentActivity({
      clientId,
      actorId: user.id,
      actorRole: user.role,
      consentId: `${clientId}_${consentType}`,
      consentType,
      granted: true,
    });

    const status = await getConsentStatus(clientId, consentType as ConsentType);

    return NextResponse.json({
      success: true,
      data: status,
    });
  },
  {
    action: "UPDATE",
    resource: "CLIENT",
    getDetails: ({ body }) => ({
      operation: "consent_granted",
      consentType: body?.consentType,
      method: body?.method,
    }),
  }
);

/**
 * DELETE /api/clients/[clientId]/consent
 * Revoke consent for a client
 */
export const DELETE = withAuthAndAudit(
  async (request, context, user) => {
    const params = await context.params;
    const clientId = params.clientId;

    const url = new URL(request.url);
    const consentType = url.searchParams.get("consentType");
    const reason = url.searchParams.get("reason") || undefined;

    // Validate consent type
    if (!consentType || !Object.values(ConsentType).includes(consentType as ConsentType)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: `Invalid consentType. Must be one of: ${Object.values(ConsentType).join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    // Verify client exists and belongs to user's org
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { orgId: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    if (client.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    await revokeConsent({
      clientId,
      consentType: consentType as ConsentType,
      revokedById: user.id,
      reason,
    });

    // Mark recordings for deletion (if recording consent revoked)
    let recordingsMarked = 0;
    if (consentType === ConsentType.RECORDING) {
      recordingsMarked = await markRecordingsForDeletion(clientId, user.id);
    }

    // Log to activity feed
    await logConsentActivity({
      clientId,
      actorId: user.id,
      actorRole: user.role,
      consentId: `${clientId}_${consentType}`,
      consentType,
      granted: false,
    });

    return NextResponse.json({
      success: true,
      data: {
        revoked: true,
        recordingsMarkedForDeletion: recordingsMarked,
        retentionDays: 30,
      },
    });
  },
  {
    action: "UPDATE",
    resource: "CLIENT",
    getDetails: ({ request }) => {
      const url = new URL(request.url);
      return {
        operation: "consent_revoked",
        consentType: url.searchParams.get("consentType"),
        reason: url.searchParams.get("reason"),
      };
    },
  }
);
