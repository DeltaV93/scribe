import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  getScheduledReports,
  updateReportSchedule,
  getSchedulePresets,
  getTimezoneOptions,
} from "@/lib/services/reporting";

// Validation schema for creating/updating a schedule
const scheduleSchema = z.object({
  templateId: z.string().uuid(),
  enabled: z.boolean(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  distributionSettings: z
    .object({
      enabled: z.boolean(),
      recipients: z.array(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
          type: z.enum(["to", "cc", "bcc"]),
        })
      ),
      subject: z.string().optional(),
      message: z.string().optional(),
      attachPdf: z.boolean(),
    })
    .optional(),
});

/**
 * GET /api/reports/schedules - List scheduled reports
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Check if requesting presets or timezones
    const preset = searchParams.get("preset");

    if (preset === "options") {
      return NextResponse.json({
        data: {
          schedulePresets: getSchedulePresets(),
          timezoneOptions: getTimezoneOptions(),
        },
      });
    }

    const result = await getScheduledReports(user.orgId);

    return NextResponse.json({
      data: result.schedules,
      total: result.total,
    });
  } catch (error) {
    console.error("Error listing scheduled reports:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list scheduled reports" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/schedules - Create or update a report schedule
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);

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

    const { templateId, enabled, cronExpression, timezone, distributionSettings } = validation.data;

    const result = await updateReportSchedule(templateId, user.orgId, {
      enabled,
      cronExpression,
      timezone,
      distributionSettings,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: {
        success: true,
        nextRunAt: result.nextRunAt,
      },
    });
  } catch (error) {
    console.error("Error updating report schedule:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update schedule" } },
      { status: 500 }
    );
  }
}
