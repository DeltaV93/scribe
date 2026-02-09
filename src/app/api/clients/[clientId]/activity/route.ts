import { NextRequest, NextResponse } from "next/server";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { prisma } from "@/lib/db";

interface ActivityItem {
  id: string;
  type: "call" | "note" | "submission";
  title: string;
  description?: string;
  status?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/clients/:clientId/activity
 *
 * Get activity feed for a client (calls, notes, submissions)
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - type: "call" | "note" | "submission" (optional filter)
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { clientId } = await context.params;

      // Verify client belongs to user's org
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          orgId: user.orgId,
          deletedAt: null,
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404 }
        );
      }

      // Parse query params
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");
      const typeFilter = searchParams.get("type");

      const activities: ActivityItem[] = [];

      // Fetch calls (if not filtered or filtered to calls)
      if (!typeFilter || typeFilter === "call") {
        const calls = await prisma.call.findMany({
          where: { clientId },
          orderBy: { startedAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            status: true,
            startedAt: true,
            durationSeconds: true,
            aiSummary: true,
            caseManager: {
              select: { name: true },
            },
          },
        });

        for (const call of calls) {
          const summary = call.aiSummary as { overview?: string } | null;
          activities.push({
            id: `call-${call.id}`,
            type: "call",
            title: `Call with ${call.caseManager.name || "Case Manager"}`,
            description: summary?.overview,
            status: call.status,
            timestamp: call.startedAt.toISOString(),
            metadata: {
              duration: call.durationSeconds,
              callStatus: call.status,
            },
          });
        }
      }

      // Fetch notes (if not filtered or filtered to notes)
      if (!typeFilter || typeFilter === "note") {
        const notes = await prisma.note.findMany({
          where: {
            clientId,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            type: true,
            content: true,
            createdAt: true,
            author: {
              select: { name: true },
            },
          },
        });

        for (const note of notes) {
          // Strip HTML tags for description preview
          const plainText = note.content.replace(/<[^>]*>/g, "").slice(0, 100);
          activities.push({
            id: `note-${note.id}`,
            type: "note",
            title: `Note by ${note.author.name || "Unknown"}`,
            description: plainText + (note.content.length > 100 ? "..." : ""),
            timestamp: note.createdAt.toISOString(),
            metadata: {
              noteType: note.type,
            },
          });
        }
      }

      // Fetch form submissions (if not filtered or filtered to submissions)
      if (!typeFilter || typeFilter === "submission") {
        const submissions = await prisma.formSubmission.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            status: true,
            createdAt: true,
            form: {
              select: { name: true },
            },
          },
        });

        for (const submission of submissions) {
          activities.push({
            id: `submission-${submission.id}`,
            type: "submission",
            title: `Form: ${submission.form.name}`,
            status: submission.status === "SUBMITTED" ? "COMPLETED" : "PENDING",
            timestamp: submission.createdAt.toISOString(),
            metadata: {
              formName: submission.form.name,
            },
          });
        }
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination to combined results
      const paginatedActivities = activities.slice(0, limit);
      const hasMore = activities.length > limit;

      return NextResponse.json({
        success: true,
        data: {
          activities: paginatedActivities,
          hasMore,
          total: activities.length,
        },
      });
    } catch (error) {
      console.error("Error fetching client activity:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch activity" } },
        { status: 500 }
      );
    }
  },
  { action: "VIEW", resource: "CLIENT" }
);
