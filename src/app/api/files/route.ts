import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listFiles, type ScanStatus } from "@/lib/files";

// GET /api/files - List files for the organization
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
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const scanStatus = searchParams.get("scanStatus") as ScanStatus | null;

    const result = await listFiles(membership.org_id, {
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      scanStatus: scanStatus || undefined,
    });

    return NextResponse.json({
      files: result.files,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
