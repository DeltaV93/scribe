import { prisma } from "@/lib/db";
import crypto from "crypto";
import { queryAuditLogs, getAuditStats, verifyAuditChain } from "./service";
import type {
  ComplianceReport,
  ComplianceReportType,
  ComplianceReportData,
  AuditAction,
  AuditResource,
} from "./types";
import type { Prisma } from "@prisma/client";

/**
 * Generate a compliance report
 */
export async function generateComplianceReport(
  orgId: string,
  reportType: ComplianceReportType,
  startDate: Date,
  endDate: Date,
  generatedById: string
): Promise<ComplianceReport> {
  let data: ComplianceReportData;

  switch (reportType) {
    case "ACTIVITY_SUMMARY":
      data = await generateActivitySummary(orgId, startDate, endDate);
      break;
    case "DATA_ACCESS":
      data = await generateDataAccessReport(orgId, startDate, endDate);
      break;
    case "USER_ACTIVITY":
      data = await generateUserActivityReport(orgId, startDate, endDate);
      break;
    case "FORM_SUBMISSIONS":
      data = await generateFormSubmissionsReport(orgId, startDate, endDate);
      break;
    case "FILE_AUDIT":
      data = await generateFileAuditReport(orgId, startDate, endDate);
      break;
    case "CHAIN_INTEGRITY":
      data = await generateChainIntegrityReport(orgId);
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  // Generate hash for report integrity
  const reportHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");

  // Store the report
  const report = await prisma.complianceReport.create({
    data: {
      orgId,
      reportType,
      startDate,
      endDate,
      generatedById,
      data: data as unknown as Prisma.InputJsonValue,
      hash: reportHash,
    },
  });

  return {
    id: report.id,
    orgId: report.orgId,
    reportType: report.reportType as ComplianceReportType,
    startDate: report.startDate,
    endDate: report.endDate,
    generatedAt: report.generatedAt,
    generatedById: report.generatedById,
    data: report.data as unknown as ComplianceReportData,
    hash: report.hash,
  };
}

/**
 * Get a compliance report by ID
 */
export async function getComplianceReport(
  reportId: string,
  orgId: string
): Promise<ComplianceReport | null> {
  const report = await prisma.complianceReport.findFirst({
    where: { id: reportId, orgId },
  });

  if (!report) return null;

  return {
    id: report.id,
    orgId: report.orgId,
    reportType: report.reportType as ComplianceReportType,
    startDate: report.startDate,
    endDate: report.endDate,
    generatedAt: report.generatedAt,
    generatedById: report.generatedById,
    data: report.data as unknown as ComplianceReportData,
    hash: report.hash,
  };
}

/**
 * List compliance reports for an organization
 */
export async function listComplianceReports(
  orgId: string,
  options: { limit?: number; offset?: number; reportType?: ComplianceReportType } = {}
): Promise<{ reports: ComplianceReport[]; total: number }> {
  const { limit = 20, offset = 0, reportType } = options;

  const where: Prisma.ComplianceReportWhereInput = {
    orgId,
    ...(reportType && { reportType }),
  };

  const [reports, total] = await Promise.all([
    prisma.complianceReport.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.complianceReport.count({ where }),
  ]);

  return {
    reports: reports.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      reportType: r.reportType as ComplianceReportType,
      startDate: r.startDate,
      endDate: r.endDate,
      generatedAt: r.generatedAt,
      generatedById: r.generatedById,
      data: r.data as unknown as ComplianceReportData,
      hash: r.hash,
    })),
    total,
  };
}

/**
 * Verify a report's integrity
 */
export async function verifyReportIntegrity(
  reportId: string,
  orgId: string
): Promise<{ valid: boolean; error?: string }> {
  const report = await prisma.complianceReport.findFirst({
    where: { id: reportId, orgId },
  });

  if (!report) {
    return { valid: false, error: "Report not found" };
  }

  const calculatedHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(report.data))
    .digest("hex");

  if (calculatedHash !== report.hash) {
    return { valid: false, error: "Report has been modified" };
  }

  return { valid: true };
}

// Report generators

async function generateActivitySummary(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReportData> {
  const stats = await getAuditStats(orgId, startDate, endDate);

  // Get daily activity counts
  const dailyActivity = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(timestamp) as date, COUNT(*) as count
    FROM "AuditLog"
    WHERE "orgId" = ${orgId}
      AND timestamp >= ${startDate}
      AND timestamp <= ${endDate}
    GROUP BY DATE(timestamp)
    ORDER BY date
  `;

  return {
    summary: {
      totalEvents: stats.totalEntries,
      uniqueUsers: stats.byUser.length,
      actionBreakdown: stats.byAction,
      resourceBreakdown: stats.byResource,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    },
    details: dailyActivity.map((d) => ({
      date: d.date,
      count: Number(d.count),
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    },
  };
}

async function generateDataAccessReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReportData> {
  const accessActions: AuditAction[] = ["VIEW", "DOWNLOAD", "EXPORT"];

  const { entries } = await queryAuditLogs({
    orgId,
    startDate,
    endDate,
    limit: 1000,
  });

  const accessEvents = entries.filter((e) => accessActions.includes(e.action));

  // Group by user and resource
  const byUser: Record<string, { resources: Set<string>; count: number }> = {};
  for (const event of accessEvents) {
    if (!event.userId) continue;
    if (!byUser[event.userId]) {
      byUser[event.userId] = { resources: new Set(), count: 0 };
    }
    byUser[event.userId].resources.add(`${event.resource}:${event.resourceId}`);
    byUser[event.userId].count++;
  }

  return {
    summary: {
      totalAccessEvents: accessEvents.length,
      uniqueUsersAccessed: Object.keys(byUser).length,
      resourcesAccessed: new Set(accessEvents.map((e) => `${e.resource}:${e.resourceId}`)).size,
    },
    details: accessEvents.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      userId: e.userId,
      action: e.action,
      resource: e.resource,
      resourceId: e.resourceId,
      resourceName: e.resourceName,
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    },
  };
}

async function generateUserActivityReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReportData> {
  const stats = await getAuditStats(orgId, startDate, endDate);

  // Get user details
  const userIds = stats.byUser.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    summary: {
      totalUsers: stats.byUser.length,
      totalActions: stats.totalEntries,
      averageActionsPerUser: stats.byUser.length > 0
        ? Math.round(stats.totalEntries / stats.byUser.length)
        : 0,
    },
    details: stats.byUser.map((u) => {
      const user = userMap.get(u.userId);
      return {
        userId: u.userId,
        email: user?.email,
        name: user?.name,
        actionCount: u.count,
      };
    }),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    },
  };
}

async function generateFormSubmissionsReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReportData> {
  const submissions = await prisma.formSubmission.findMany({
    where: {
      orgId,
      submittedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      form: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  // Group by form
  const byForm: Record<string, { formName: string; count: number }> = {};
  for (const sub of submissions) {
    if (!byForm[sub.formId]) {
      byForm[sub.formId] = { formName: sub.form.name, count: 0 };
    }
    byForm[sub.formId].count++;
  }

  // Group by status
  const byStatus: Record<string, number> = {};
  for (const sub of submissions) {
    byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;
  }

  return {
    summary: {
      totalSubmissions: submissions.length,
      uniqueForms: Object.keys(byForm).length,
      byForm: Object.entries(byForm).map(([formId, data]) => ({
        formId,
        formName: data.formName,
        count: data.count,
      })),
      byStatus,
    },
    details: submissions.map((s) => ({
      submissionId: s.id,
      formId: s.formId,
      formName: s.form.name,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString() || null,
      clientId: s.clientId,
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    },
  };
}

async function generateFileAuditReport(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReportData> {
  const fileActions: AuditAction[] = ["UPLOAD", "DOWNLOAD", "DELETE", "SCAN"];

  const { entries } = await queryAuditLogs({
    orgId,
    resource: "FILE" as AuditResource,
    startDate,
    endDate,
    limit: 1000,
  });

  // Group by action type
  const byAction: Record<string, number> = {};
  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
  }

  // Get file scan results
  const files = await prisma.fileUpload.findMany({
    where: {
      orgId,
      uploadedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      originalName: true,
      scanStatus: true,
      sizeBytes: true,
      mimeType: true,
      uploadedAt: true,
    },
  });

  // Group by scan status
  const byScanStatus: Record<string, number> = {};
  for (const file of files) {
    byScanStatus[file.scanStatus] = (byScanStatus[file.scanStatus] || 0) + 1;
  }

  return {
    summary: {
      totalFileEvents: entries.length,
      filesUploaded: files.length,
      totalSizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
      byAction,
      byScanStatus,
    },
    details: entries.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      action: e.action,
      fileId: e.resourceId,
      fileName: e.resourceName,
      userId: e.userId,
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    },
  };
}

async function generateChainIntegrityReport(
  orgId: string
): Promise<ComplianceReportData> {
  const verification = await verifyAuditChain(orgId);

  return {
    summary: {
      chainValid: verification.valid,
      totalEntries: verification.totalEntries,
      verifiedEntries: verification.verifiedEntries,
      ...(verification.brokenAt && {
        brokenAt: {
          entryId: verification.brokenAt.entryId,
          position: verification.brokenAt.position,
        },
      }),
    },
    details: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      reportVersion: "1.0",
      filters: {},
    },
  };
}

/**
 * Export a report to CSV format
 */
export function exportReportToCSV(report: ComplianceReport): string {
  const details = report.data.details as Record<string, unknown>[];

  if (details.length === 0) {
    return "No data available";
  }

  // Get headers from first row
  const headers = Object.keys(details[0]);
  const csvRows = [headers.join(",")];

  for (const row of details) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      if (typeof val === "string" && val.includes(",")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
