import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateComplianceReport,
  listComplianceReports,
  type ComplianceReportType,
} from "@/lib/audit";

// GET /api/compliance/reports - List compliance reports
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 }
      );
    }

    // Only admins can view compliance reports
    if (membership.role !== "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType") as ComplianceReportType | null;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await listComplianceReports(membership.org_id, {
      reportType: reportType || undefined,
      limit: Math.min(limit, 50),
      offset,
    });

    return NextResponse.json({
      reports: result.reports,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("List reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/compliance/reports - Generate a new compliance report
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization and user ID
    const { data: membership } = await supabase
      .from("organization_members")
      .select("org_id, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 }
      );
    }

    // Only admins can generate reports
    if (membership.role !== "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reportType, startDate, endDate } = body;

    if (!reportType) {
      return NextResponse.json(
        { error: "Report type is required" },
        { status: 400 }
      );
    }

    const validTypes: ComplianceReportType[] = [
      "ACTIVITY_SUMMARY",
      "DATA_ACCESS",
      "USER_ACTIVITY",
      "FORM_SUBMISSIONS",
      "FILE_AUDIT",
      "CHAIN_INTEGRITY",
    ];

    if (!validTypes.includes(reportType)) {
      return NextResponse.json(
        { error: `Invalid report type. Valid types: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Default date range: last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const report = await generateComplianceReport(
      membership.org_id,
      reportType,
      start,
      end,
      membership.user_id
    );

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
