import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  updateExtractionExample,
  deleteExtractionExample,
} from "@/lib/ai/examples";

interface RouteParams {
  params: Promise<{ exampleId: string }>;
}

const updateSchema = z.object({
  transcriptSnippet: z.string().min(1).max(5000).optional(),
  extractedValue: z.string().min(1).max(1000).optional(),
});

/**
 * PATCH /api/ai/examples/[exampleId]
 * Update an extraction example
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    const { exampleId } = await params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify example belongs to user's org
    const existingExample = await prisma.extractionExample.findFirst({
      where: {
        id: exampleId,
        field: {
          form: {
            orgId: user.orgId,
          },
        },
      },
    });

    if (!existingExample) {
      return NextResponse.json({ error: "Example not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const example = await updateExtractionExample(exampleId, validation.data);

    return NextResponse.json({ example });
  } catch (error) {
    console.error("Update example error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/examples/[exampleId]
 * Delete an extraction example
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    const { exampleId } = await params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify example belongs to user's org
    const existingExample = await prisma.extractionExample.findFirst({
      where: {
        id: exampleId,
        field: {
          form: {
            orgId: user.orgId,
          },
        },
      },
    });

    if (!existingExample) {
      return NextResponse.json({ error: "Example not found" }, { status: 404 });
    }

    await deleteExtractionExample(exampleId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete example error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
