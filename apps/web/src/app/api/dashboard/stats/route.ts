import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the current user's organization
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get start of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all stats in parallel
    const [
      activeForms,
      totalClients,
      callsThisMonth,
      submissionsThisMonth,
    ] = await Promise.all([
      // Active (published) forms
      prisma.form.count({
        where: {
          orgId: user.orgId,
          status: "PUBLISHED",
        },
      }),
      // Total clients
      prisma.client.count({
        where: {
          orgId: user.orgId,
        },
      }),
      // Calls this month (through caseManager relation)
      prisma.call.count({
        where: {
          caseManager: { orgId: user.orgId },
          startedAt: {
            gte: monthStart,
          },
        },
      }),
      // Form submissions this month
      prisma.formSubmission.count({
        where: {
          orgId: user.orgId,
          submittedAt: {
            gte: monthStart,
          },
        },
      }),
    ]);

    return NextResponse.json({
      activeForms,
      totalClients,
      callsThisMonth,
      submissionsThisMonth,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
