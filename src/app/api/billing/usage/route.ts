import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsageStats } from "@/lib/billing";

// GET /api/billing/usage - Get usage statistics
export async function GET() {
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

    const stats = await getUsageStats(membership.org_id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Get usage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
