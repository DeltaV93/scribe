import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { getClientById, getClientCalls } from "@/lib/services/clients";
import { UserRole } from "@/types";

/**
 * GET /api/clients/:clientId/calls - Get call history for a client
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { clientId } = await context.params;

      // Parse query parameters
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get("limit") || "10", 10);

      // Check client exists and user has access
      const client = await getClientById(clientId, user.orgId);

      if (!client) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404 }
        );
      }

      // Case managers can only view their own assigned clients
      if (
        user.role === UserRole.CASE_MANAGER &&
        client.assignedTo !== user.id
      ) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's calls" } },
          { status: 403 }
        );
      }

      const calls = await getClientCalls(clientId, Math.min(limit, 50));

      return NextResponse.json({
        success: true,
        data: calls,
      });
    } catch (error) {
      console.error("Error fetching client calls:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client calls" } },
        { status: 500 }
      );
    }
  },
  {
    action: "VIEW",
    resource: "CALL",
    getResourceId: ({ params }) => params.clientId,
  }
);
