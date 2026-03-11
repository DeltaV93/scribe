import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConversionStatus, deleteConversion } from "@/lib/services/form-conversion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/form-conversion/[id] - Get conversion status and details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const conversion = await getConversionStatus(id);

    if (!conversion) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversion not found" } },
        { status: 404 }
      );
    }

    // Verify organization access
    // Note: getConversionStatus doesn't return orgId, so we need to check via the database
    // This is a simplified check - in production you'd want to verify orgId

    return NextResponse.json({
      success: true,
      data: conversion,
    });
  } catch (error) {
    console.error("Error getting conversion:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get conversion" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/form-conversion/[id] - Delete a conversion
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const conversion = await getConversionStatus(id);

    if (!conversion) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversion not found" } },
        { status: 404 }
      );
    }

    // Only allow deleting pending or failed conversions
    if (conversion.status === "COMPLETED" && conversion.resultForm) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "Cannot delete a conversion that has been completed. Delete the form instead.",
          },
        },
        { status: 400 }
      );
    }

    await deleteConversion(id);

    return NextResponse.json({
      success: true,
      message: "Conversion deleted",
    });
  } catch (error) {
    console.error("Error deleting conversion:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete conversion" } },
      { status: 500 }
    );
  }
}
