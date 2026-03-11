import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAuditChain, verifyIntegrityProof } from "@/lib/audit";

// GET /api/audit/verify - Verify the entire audit chain
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

    // Only admins can verify the chain
    if (membership.role !== "ADMIN" && membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const verification = await verifyAuditChain(membership.org_id);

    return NextResponse.json(verification);
  } catch (error) {
    console.error("Chain verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/audit/verify - Verify an integrity proof
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proof } = body;

    if (!proof) {
      return NextResponse.json(
        { error: "Proof is required" },
        { status: 400 }
      );
    }

    const result = verifyIntegrityProof(proof);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Proof verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
