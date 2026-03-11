import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById, getClientFormSubmissions } from "@/lib/services/clients";
import { UserRole } from "@/types";

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/forms - Get form submissions for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

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
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's forms" } },
        { status: 403 }
      );
    }

    const submissions = await getClientFormSubmissions(clientId);

    return NextResponse.json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("Error fetching client form submissions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client form submissions" } },
      { status: 500 }
    );
  }
}
