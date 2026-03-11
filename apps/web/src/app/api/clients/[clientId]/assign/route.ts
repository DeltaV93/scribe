import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { assignClient } from "@/lib/services/client-matching";
import { getClientById } from "@/lib/services/clients";
import { UserRole } from "@/types";
import { z } from "zod";

const assignSchema = z.object({
  caseManagerId: z.string().uuid("Invalid case manager ID"),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * POST /api/clients/:clientId/assign
 * Assign a client to a case manager
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Only admins and program managers can assign clients
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to assign clients" } },
        { status: 403 }
      );
    }

    // Verify client exists
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = assignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { caseManagerId } = validation.data;

    // Check if already assigned to this case manager
    if (client.assignedTo === caseManagerId) {
      return NextResponse.json(
        { error: { code: "ALREADY_ASSIGNED", message: "Client is already assigned to this case manager" } },
        { status: 400 }
      );
    }

    // Perform assignment
    await assignClient(clientId, caseManagerId, user.orgId);

    // Fetch updated client
    const updatedClient = await getClientById(clientId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Client assigned successfully",
      data: {
        clientId,
        clientName: `${updatedClient?.firstName} ${updatedClient?.lastName}`,
        previousCaseManager: client.assignedTo,
        newCaseManager: caseManagerId,
        assignedUser: updatedClient?.assignedUser,
      },
    });
  } catch (error) {
    console.error("Error assigning client:", error);

    if (error instanceof Error) {
      // Handle known business logic errors
      if (
        error.message.includes("maximum caseload") ||
        error.message.includes("not found") ||
        error.message.includes("not eligible")
      ) {
        return NextResponse.json(
          { error: { code: "ASSIGNMENT_FAILED", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to assign client" } },
      { status: 500 }
    );
  }
}
