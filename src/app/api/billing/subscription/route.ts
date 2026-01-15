import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionDetails,
  createSubscriptionCheckout,
  cancelOrgSubscription,
  reactivateOrgSubscription,
  type SubscriptionTier,
} from "@/lib/billing";

// GET /api/billing/subscription - Get current subscription
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

    const details = await getSubscriptionDetails(membership.org_id);
    return NextResponse.json(details);
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/billing/subscription - Create checkout or manage subscription
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

    // Only admins can manage billing
    if (membership.role !== "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, tier, billingPeriod } = body;

    switch (action) {
      case "checkout": {
        if (!tier || !billingPeriod) {
          return NextResponse.json(
            { error: "Tier and billing period are required" },
            { status: 400 }
          );
        }

        const validTiers: SubscriptionTier[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
        if (!validTiers.includes(tier)) {
          return NextResponse.json(
            { error: "Invalid tier" },
            { status: 400 }
          );
        }

        const result = await createSubscriptionCheckout(
          membership.org_id,
          tier,
          billingPeriod
        );
        return NextResponse.json(result);
      }

      case "cancel": {
        const result = await cancelOrgSubscription(membership.org_id);
        return NextResponse.json(result);
      }

      case "reactivate": {
        const result = await reactivateOrgSubscription(membership.org_id);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Subscription action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
