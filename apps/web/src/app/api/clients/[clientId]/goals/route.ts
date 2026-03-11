import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClientGoal, listClientGoals } from "@/lib/services/client-goals";
import { ClientOutcomeType, ClientGoalStatus, KpiMetricType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Validation schema for creating a client goal
const createClientGoalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  outcomeType: z.nativeEnum(ClientOutcomeType),
  metricType: z.nativeEnum(KpiMetricType).nullable().optional(),
  targetValue: z.number().positive().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  startDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  deadline: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  clientVisibility: z.boolean().optional(),
  clientCanEdit: z.boolean().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  programId: z.string().uuid().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/[clientId]/goals - List goals for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ClientGoalStatus | null;
    const outcomeType = searchParams.get("outcomeType") as ClientOutcomeType | null;
    const assignedToId = searchParams.get("assignedToId") || undefined;
    const programId = searchParams.get("programId") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listClientGoals(
      clientId,
      user.orgId,
      user.id,
      {
        status: status || undefined,
        outcomeType: outcomeType || undefined,
        assignedToId,
        programId,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.goals,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing client goals:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list client goals" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[clientId]/goals - Create a new goal for a client
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
    });

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createClientGoalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const goal = await createClientGoal({
      orgId: user.orgId,
      clientId,
      createdById: user.id,
      title: data.title,
      description: data.description,
      outcomeType: data.outcomeType,
      metricType: data.metricType,
      targetValue: data.targetValue,
      unit: data.unit,
      startDate: data.startDate,
      deadline: data.deadline,
      clientVisibility: data.clientVisibility,
      clientCanEdit: data.clientCanEdit,
      assignedToId: data.assignedToId,
      programId: data.programId,
    });

    return NextResponse.json({ success: true, data: goal }, { status: 201 });
  } catch (error) {
    console.error("Error creating client goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create client goal" } },
      { status: 500 }
    );
  }
}
