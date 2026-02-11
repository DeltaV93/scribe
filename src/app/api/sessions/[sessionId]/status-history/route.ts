/**
 * Session Status History API (PX-723)
 * GET: Retrieve status change history for a session
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, withAuth } from "@/lib/auth/with-auth-audit";
import { getSessionStatusHistory } from "@/lib/services/session-status-history";
import { prisma } from "@/lib/db";

/**
 * GET /api/sessions/[sessionId]/status-history
 * Returns the status change history for a session
 */
export const GET = withAuth(async (request, context, user) => {
  const params = await context.params;
  const sessionId = params.sessionId;

  // Verify session exists and user has access
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: {
          orgId: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Session not found" } },
      { status: 404 }
    );
  }

  // Verify org access
  if (session.program.orgId !== user.orgId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 }
    );
  }

  const history = await getSessionStatusHistory(sessionId);

  return NextResponse.json({
    success: true,
    data: history,
  });
});
