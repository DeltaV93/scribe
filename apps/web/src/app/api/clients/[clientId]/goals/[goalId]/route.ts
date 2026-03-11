import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getClientGoalById,
  updateClientGoal,
  archiveClientGoal,
  markGoalComplete,
  markGoalAbandoned,
  updateGoalProgress,
} from "@/lib/services/client-goals";
import { ClientOutcomeType, ClientGoalStatus, KpiMetricType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Validation schema for updating a client goal
const updateClientGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  outcomeType: z.nativeEnum(ClientOutcomeType).optional(),
  status: z.nativeEnum(ClientGoalStatus).optional(),
  metricType: z.nativeEnum(KpiMetricType).nullable().optional(),
  targetValue: z.number().positive().nullable().optional(),
  currentValue: z.number().nullable().optional(),
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
  clientNotes: z.string().max(5000).nullable().optional(),
  staffNotes: z.string().max(5000).nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  programId: z.string().uuid().nullable().optional(),
});

// Validation schema for completing a goal
const completeGoalSchema = z.object({
  notes: z.string().max(5000).optional(),
});

// Validation schema for progress update
const progressUpdateSchema = z.object({
  value: z.number(),
  notes: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ clientId: string; goalId: string }>;
}

/**
 * GET /api/clients/[clientId]/goals/[goalId] - Get a client goal by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId, goalId } = await params;

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

    const goal = await getClientGoalById(goalId, user.orgId, clientId);

    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error("Error fetching client goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client goal" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[clientId]/goals/[goalId] - Update a client goal
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId, goalId } = await params;

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

    // Verify goal exists
    const existingGoal = await getClientGoalById(goalId, user.orgId, clientId);
    if (!existingGoal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateClientGoalSchema.safeParse(body);

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

    const goal = await updateClientGoal(goalId, user.orgId, clientId, validation.data);

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error("Error updating client goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update client goal" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[clientId]/goals/[goalId] - Archive a client goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId, goalId } = await params;

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

    // Verify goal exists
    const goal = await getClientGoalById(goalId, user.orgId, clientId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    await archiveClientGoal(goalId, user.orgId, clientId);

    return NextResponse.json({ success: true, message: "Goal archived successfully" });
  } catch (error) {
    console.error("Error archiving client goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive client goal" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[clientId]/goals/[goalId] - Complete or update progress
 * Action determined by query param: ?action=complete|abandon|progress
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId, goalId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "progress";

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

    // Verify goal exists
    const existingGoal = await getClientGoalById(goalId, user.orgId, clientId);
    if (!existingGoal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (action === "complete") {
      const validation = completeGoalSchema.safeParse(body);
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

      const goal = await markGoalComplete(
        goalId,
        user.orgId,
        user.id,
        validation.data.notes
      );

      return NextResponse.json({
        success: true,
        message: "Goal marked as complete",
        data: goal,
      });
    } else if (action === "abandon") {
      const validation = completeGoalSchema.safeParse(body);
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

      const goal = await markGoalAbandoned(
        goalId,
        user.orgId,
        user.id,
        validation.data.notes
      );

      return NextResponse.json({
        success: true,
        message: "Goal marked as abandoned",
        data: goal,
      });
    } else {
      // Default: progress update
      const validation = progressUpdateSchema.safeParse(body);
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

      const goal = await updateGoalProgress(
        goalId,
        user.orgId,
        clientId,
        validation.data.value,
        validation.data.notes,
        user.id
      );

      return NextResponse.json({
        success: true,
        message: "Progress updated",
        data: goal,
      });
    }
  } catch (error) {
    console.error("Error updating client goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update client goal" } },
      { status: 500 }
    );
  }
}
