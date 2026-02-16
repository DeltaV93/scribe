/**
 * Client Consent Revocation API (PX-735)
 * POST /api/clients/[clientId]/consent/revoke
 *
 * Revokes recording consent for a client.
 * Simpler endpoint than DELETE /api/clients/[clientId]/consent for frontend use.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit } from "@/lib/auth/with-auth-audit";
import {
  revokeConsent,
  markRecordingsForDeletion,
} from "@/lib/services/consent";
import { logConsentActivity } from "@/lib/services/client-activity";
import { prisma } from "@/lib/db";
import { ConsentType } from "@prisma/client";

export const POST = withAuthAndAudit(
  async (request: NextRequest, context, user) => {
    const params = await context.params;
    const clientId = params.clientId;

    // Parse optional reason from body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch {
      // No body is fine
    }

    // Verify client exists and belongs to user's org
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { orgId: true, firstName: true, lastName: true },
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

    // Revoke recording consent
    await revokeConsent({
      clientId,
      consentType: ConsentType.RECORDING,
      revokedById: user.id,
      reason,
    });

    // Mark recordings for deletion
    const recordingsMarked = await markRecordingsForDeletion(clientId, user.id);

    // Log to activity feed
    await logConsentActivity({
      clientId,
      actorId: user.id,
      actorRole: user.role,
      consentId: `${clientId}_${ConsentType.RECORDING}`,
      consentType: ConsentType.RECORDING,
      granted: false,
    });

    // Calculate retention date (30 days from now)
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + 30);

    return NextResponse.json({
      success: true,
      recordingsMarkedForDeletion: recordingsMarked,
      retentionUntil: retentionUntil.toISOString(),
    });
  },
  {
    action: "UPDATE",
    resource: "CLIENT",
    getDetails: () => ({
      operation: "consent_revoked",
      consentType: ConsentType.RECORDING,
    }),
  }
);
