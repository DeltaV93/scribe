/**
 * Export Dashboard API
 *
 * GET /api/exports/dashboard - Get dashboard overview with status for all exports
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { ExportStatus, ExportType } from "@prisma/client";
import { getScheduleStatus } from "@/lib/services/exports/scheduling";

/**
 * GET - Get export dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { orgId } = dbUser;

    // Get all data in parallel
    const [
      templates,
      recentExports,
      exportCountsByStatus,
      exportCountsByType,
      scheduleStatus,
    ] = await Promise.all([
      // Active templates summary
      prisma.exportTemplate.findMany({
        where: { orgId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          exportType: true,
          scheduleEnabled: true,
          scheduleCron: true,
          lastScheduledRunAt: true,
          nextScheduledRunAt: true,
          _count: { select: { exports: true } },
        },
        orderBy: { name: "asc" },
      }),

      // Recent exports (last 10)
      prisma.funderExport.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          recordCount: true,
          createdAt: true,
          generatedAt: true,
          template: {
            select: {
              id: true,
              name: true,
              exportType: true,
            },
          },
          generatedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      // Export counts by status
      prisma.funderExport.groupBy({
        by: ["status"],
        where: { orgId },
        _count: { status: true },
      }),

      // Export counts by type
      prisma.funderExport.groupBy({
        by: ["templateId"],
        where: { orgId },
        _count: { templateId: true },
      }),

      // Schedule status
      getScheduleStatus(orgId),
    ]);

    // Build status summary
    const statusSummary: Record<ExportStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      VALIDATION_REQUIRED: 0,
    };

    for (const group of exportCountsByStatus) {
      statusSummary[group.status] = group._count.status;
    }

    // Calculate totals
    const totalExports = Object.values(statusSummary).reduce((a, b) => a + b, 0);
    const successRate = totalExports > 0
      ? Math.round((statusSummary.COMPLETED / totalExports) * 100)
      : 0;

    // Build per-template summary
    const templateSummary = templates.map((template) => {
      const exportCount = exportCountsByType.find(
        (g) => g.templateId === template.id
      );
      const schedule = scheduleStatus.find((s) => s.templateId === template.id);

      return {
        id: template.id,
        name: template.name,
        exportType: template.exportType,
        totalExports: exportCount?._count.templateId || 0,
        schedule: {
          enabled: template.scheduleEnabled,
          cronExpression: template.scheduleCron,
          description: schedule?.scheduleDescription,
          lastRunAt: template.lastScheduledRunAt,
          nextRunAt: template.nextScheduledRunAt,
          failureCount: schedule?.failureCount || 0,
        },
        lastExport: schedule?.lastExport,
      };
    });

    // Group templates by export type
    const byExportType: Record<
      ExportType,
      typeof templateSummary
    > = {
      CAP60: [],
      DOL_WIPS: [],
      CALI_GRANTS: [],
      HUD_HMIS: [],
      CUSTOM: [],
    };

    for (const template of templateSummary) {
      byExportType[template.exportType].push(template);
    }

    // Get pending/failed that need attention
    const needsAttention = recentExports.filter(
      (e) => e.status === "FAILED" || e.status === "VALIDATION_REQUIRED"
    );

    // Get upcoming scheduled exports
    const upcomingScheduled = scheduleStatus
      .filter((s) => s.scheduleEnabled && s.nextRunAt)
      .sort((a, b) => {
        if (!a.nextRunAt || !b.nextRunAt) return 0;
        return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
      })
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalTemplates: templates.length,
        totalExports,
        successRate,
        statusCounts: statusSummary,
        scheduledTemplates: templates.filter((t) => t.scheduleEnabled).length,
      },
      templates: templateSummary,
      byExportType,
      recentExports,
      needsAttention,
      upcomingScheduled,
    });
  } catch (error) {
    console.error("Error getting dashboard:", error);
    return NextResponse.json(
      { error: "Failed to get dashboard data" },
      { status: 500 }
    );
  }
}
