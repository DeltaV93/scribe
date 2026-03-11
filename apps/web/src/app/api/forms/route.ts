import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createForm, listForms } from "@/lib/services/forms";
import { FormType, FormStatus } from "@/types";
import { z } from "zod";
import { checkApiPermission } from "@/lib/rbac";

// Validation schema for creating a form
const createFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.nativeEnum(FormType),
  settings: z
    .object({
      allowPartialSaves: z.boolean().optional(),
      requireSupervisorReview: z.boolean().optional(),
      autoArchiveDays: z.number().nullable().optional(),
      activityTriggers: z
        .array(z.enum(["submissions", "edits", "views"]))
        .optional(),
    })
    .optional(),
});

/**
 * GET /api/forms - List forms for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // RBAC: Check read permission
    const permissionCheck = await checkApiPermission(user, "forms", "read");
    if (!permissionCheck.allowed) {
      return permissionCheck.response;
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as FormStatus | null;
    const type = searchParams.get("type") as FormType | null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || undefined;

    const result = await listForms(user.orgId, {
      status: status || undefined,
      type: type || undefined,
      page,
      pageSize: Math.min(pageSize, 100), // Cap at 100
      search,
    });

    return NextResponse.json({
      success: true,
      data: result.forms,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error listing forms:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list forms" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms - Create a new form
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // RBAC: Check create permission
    const permissionCheck = await checkApiPermission(user, "forms", "create");
    if (!permissionCheck.allowed) {
      return permissionCheck.response;
    }

    const body = await request.json();
    const validation = createFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid form data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const form = await createForm({
      orgId: user.orgId,
      createdById: user.id,
      name: validation.data.name,
      description: validation.data.description,
      type: validation.data.type,
      settings: validation.data.settings,
    });

    return NextResponse.json(
      { success: true, data: form },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create form" } },
      { status: 500 }
    );
  }
}
