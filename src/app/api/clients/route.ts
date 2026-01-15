import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient, listClients } from "@/lib/services/clients";
import { ClientStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a client
const createClientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  email: z.string().email().nullable().optional(),
  address: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      formatted: z.string().optional(),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  additionalPhones: z
    .array(
      z.object({
        number: z.string(),
        label: z.string(),
      })
    )
    .nullable()
    .optional(),
  internalId: z.string().max(100).nullable().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  assignedTo: z.string().uuid().optional(),
});

/**
 * GET /api/clients - List clients for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ClientStatus | null;
    const assignedTo = searchParams.get("assignedTo");
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Case managers can only see their own caseload unless they're admin/program manager
    let effectiveAssignedTo = assignedTo;
    if (
      user.role === UserRole.CASE_MANAGER &&
      !assignedTo
    ) {
      effectiveAssignedTo = user.id;
    }

    const result = await listClients(
      user.orgId,
      {
        status: status || undefined,
        assignedTo: effectiveAssignedTo || undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100), // Cap at 100
      }
    );

    return NextResponse.json({
      success: true,
      data: result.clients,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing clients:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list clients" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients - Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only case managers, program managers, and admins can create clients
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create clients" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid client data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const client = await createClient({
      orgId: user.orgId,
      createdBy: user.id,
      assignedTo: validation.data.assignedTo || user.id, // Default to creator
      firstName: validation.data.firstName,
      lastName: validation.data.lastName,
      phone: validation.data.phone,
      email: validation.data.email,
      address: validation.data.address,
      additionalPhones: validation.data.additionalPhones,
      internalId: validation.data.internalId,
      status: validation.data.status,
    });

    return NextResponse.json(
      { success: true, data: client },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create client" } },
      { status: 500 }
    );
  }
}
