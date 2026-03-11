import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkForDuplicates } from "@/lib/services/clients";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for duplicate check
const duplicateCheckSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
});

/**
 * POST /api/clients/check-duplicate - Check for potential duplicate clients
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only users who can create clients can check for duplicates
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to check for duplicates" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = duplicateCheckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const result = await checkForDuplicates(
      user.orgId,
      validation.data.phone,
      validation.data.firstName,
      validation.data.lastName
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error checking for duplicates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to check for duplicates" } },
      { status: 500 }
    );
  }
}
