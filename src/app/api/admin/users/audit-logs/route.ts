import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getUserAuditLogs,
  exportUserAuditLogs,
  type UserManagementAction,
} from "@/lib/services/user-audit";

/**
 * GET /api/admin/users/audit-logs
 * List user management audit logs with filtering
 * Query params:
 *   - action: Filter by action type
 *   - userId: Filter by target user ID
 *   - startDate: Filter by start date (ISO string)
 *   - endDate: Filter by end date (ISO string)
 *   - limit: Number of results (default 50)
 *   - offset: Pagination offset (default 0)
 *   - export: If "csv", export as CSV file
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") as UserManagementAction | null;
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const exportFormat = searchParams.get("export");

    // Handle CSV export
    if (exportFormat === "csv") {
      const exportStartDate = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
      const exportEndDate = endDate ? new Date(endDate) : new Date();

      const entries = await exportUserAuditLogs(
        user.orgId,
        exportStartDate,
        exportEndDate
      );

      // Convert to CSV
      const csvHeaders = [
        "Timestamp",
        "Action",
        "Target User",
        "Target Email",
        "Performed By",
        "Performer Email",
        "Details",
      ];

      const csvRows = entries.map((entry) => {
        const details = entry.details as Record<string, unknown>;
        return [
          new Date(entry.timestamp).toISOString(),
          entry.action,
          entry.resourceName || "",
          (details.targetEmail as string) || "",
          entry.actor?.name || "",
          entry.actor?.email || "",
          JSON.stringify(details),
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(",");
      });

      const csv = [csvHeaders.join(","), ...csvRows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Regular paginated query
    const { entries, total } = await getUserAuditLogs(user.orgId, {
      action: action || undefined,
      targetUserId: userId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: entries,
      pagination: {
        total,
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
