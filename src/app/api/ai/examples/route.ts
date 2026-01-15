import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  addExtractionExample,
  getFieldExamples,
  learnFromExtraction,
} from "@/lib/ai/examples";

// Request schemas
const createExampleSchema = z.object({
  fieldId: z.string().uuid(),
  transcriptSnippet: z.string().min(1).max(5000),
  extractedValue: z.string().min(1).max(1000),
});

const learnSchema = z.object({
  fieldId: z.string().uuid(),
  sourceSnippet: z.string().min(1).max(5000),
  extractedValue: z.string().min(1).max(1000),
});

/**
 * GET /api/ai/examples?fieldId=xxx
 * Get extraction examples for a field
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get("fieldId");

    if (!fieldId) {
      return NextResponse.json(
        { error: "fieldId is required" },
        { status: 400 }
      );
    }

    // Verify field belongs to user's org
    const field = await prisma.formField.findFirst({
      where: {
        id: fieldId,
        form: {
          orgId: user.orgId,
        },
      },
    });

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    const examples = await getFieldExamples(fieldId);

    return NextResponse.json({ examples });
  } catch (error) {
    console.error("Get examples error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/examples
 * Create a new extraction example
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Check if this is a "learn" request
    if (body.action === "learn") {
      const validation = learnSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid request", details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const { fieldId, sourceSnippet, extractedValue } = validation.data;

      // Verify field belongs to user's org
      const field = await prisma.formField.findFirst({
        where: {
          id: fieldId,
          form: {
            orgId: user.orgId,
          },
        },
      });

      if (!field) {
        return NextResponse.json({ error: "Field not found" }, { status: 404 });
      }

      await learnFromExtraction(
        fieldId,
        sourceSnippet,
        extractedValue,
        user.id
      );

      return NextResponse.json({ success: true });
    }

    // Regular example creation
    const validation = createExampleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { fieldId, transcriptSnippet, extractedValue } = validation.data;

    // Verify field belongs to user's org
    const field = await prisma.formField.findFirst({
      where: {
        id: fieldId,
        form: {
          orgId: user.orgId,
        },
      },
    });

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    const example = await addExtractionExample(
      fieldId,
      transcriptSnippet,
      extractedValue,
      user.id
    );

    return NextResponse.json({ example }, { status: 201 });
  } catch (error) {
    console.error("Create example error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
