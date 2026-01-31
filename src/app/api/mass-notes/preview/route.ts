import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { previewMassNotes } from "@/lib/services/mass-notes";

// Validation schema for previewing mass notes
const previewMassNotesSchema = z.object({
  sessionId: z.string().uuid(),
  templateContent: z.string().min(1).max(10000),
  clientIds: z.array(z.string().uuid()).min(1).max(10),
  customVariables: z.record(z.string()).optional(),
});

/**
 * POST /api/mass-notes/preview - Preview mass notes for clients
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = previewMassNotesSchema.safeParse(body);

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

    const previews = await previewMassNotes({
      sessionId: validation.data.sessionId,
      orgId: user.orgId,
      templateContent: validation.data.templateContent,
      clientIds: validation.data.clientIds,
      customVariables: validation.data.customVariables,
    });

    return NextResponse.json({
      success: true,
      data: previews,
    });
  } catch (error) {
    console.error("Error previewing mass notes:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to preview mass notes" } },
      { status: 500 }
    );
  }
}
