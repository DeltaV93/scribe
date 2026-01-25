import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById } from "@/lib/services/clients";
import {
  getClientSmsPreference,
  updateSmsPreference,
  formatPhoneToE164,
  isValidPhoneNumber,
} from "@/lib/services/sms-notifications";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating SMS preference
const updateSmsPreferenceSchema = z.object({
  optedIn: z.boolean(),
  phoneNumber: z.string().min(10).max(20),
  optInMethod: z.enum(["portal", "verbal", "written"]),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/sms-preference - Get client's SMS preference
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Verify client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view their assigned clients' preferences
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's preferences" } },
        { status: 403 }
      );
    }

    const preference = await getClientSmsPreference(clientId);

    // Return preference or default state
    return NextResponse.json({
      success: true,
      data: preference || {
        optedIn: false,
        phoneNumber: client.phone ? formatPhoneToE164(client.phone) : null,
        optInMethod: null,
        optedInAt: null,
      },
    });
  } catch (error) {
    console.error("Error fetching SMS preference:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch SMS preference" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/:clientId/sms-preference - Update client's SMS preference
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot update preferences
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update SMS preferences" } },
        { status: 403 }
      );
    }

    // Verify client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only update their assigned clients' preferences
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update this client's preferences" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateSmsPreferenceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid SMS preference data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { optedIn, phoneNumber, optInMethod } = validation.data;

    // Format and validate phone number
    const formattedPhone = formatPhoneToE164(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid phone number format",
          },
        },
        { status: 400 }
      );
    }

    await updateSmsPreference(clientId, {
      optedIn,
      phoneNumber: formattedPhone,
      optInMethod,
    });

    // Return updated preference
    const updatedPreference = await getClientSmsPreference(clientId);

    return NextResponse.json({
      success: true,
      data: updatedPreference,
    });
  } catch (error) {
    console.error("Error updating SMS preference:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update SMS preference" } },
      { status: 500 }
    );
  }
}
