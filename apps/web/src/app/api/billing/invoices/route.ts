import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceHistory, getUpcomingInvoicePreview } from "@/lib/billing";

// GET /api/billing/invoices - Get invoice history
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
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 }
      );
    }

    // Only admins can view invoices
    if (membership.role !== "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const [invoices, upcoming] = await Promise.all([
      getInvoiceHistory(membership.org_id),
      getUpcomingInvoicePreview(membership.org_id),
    ]);

    return NextResponse.json({ invoices, upcoming });
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
