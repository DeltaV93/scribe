import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import { createLinearIssue, addDelaySignalComment } from "@/lib/integrations/linear";
import { createCalendarEvent } from "@/lib/integrations/google-calendar";
import { createNotionPage } from "@/lib/integrations/notion";
import type { ActionItemDraft, CalendarEventDraft, MeetingNotesDraft, DelaySignalDraft } from "@/lib/services/workflow-outputs";

interface RouteParams {
  params: Promise<{ id: string; outputId: string }>;
}

/**
 * POST /api/conversations/:id/outputs/:outputId/push
 * Push output to destination platform
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, outputId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
      include: {
        conversation: {
          select: { orgId: true },
        },
      },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    if (output.status !== "APPROVED") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Output must be approved before pushing" } },
        { status: 400 }
      );
    }

    if (!output.destinationPlatform) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No destination platform configured" } },
        { status: 400 }
      );
    }

    const orgId = output.conversation.orgId;
    const content = output.editedContent || output.content;
    const metadata = output.metadata as Record<string, unknown> || {};
    const config = output.destinationConfig as Record<string, unknown> || {};

    let externalId: string | undefined;

    try {
      switch (output.destinationPlatform) {
        case "LINEAR": {
          const draft: ActionItemDraft = {
            title: output.title || "Action Item",
            description: content,
            assignee: metadata.assignee as string | undefined,
            dueDate: metadata.dueDate as string | undefined,
            priority: metadata.priority as "low" | "medium" | "high" | "urgent" | undefined,
            labels: metadata.labels as string[] | undefined,
            sourceSnippet: output.sourceSnippet || "",
          };

          const issue = await createLinearIssue(orgId, draft, {
            teamId: config.teamId as string | undefined,
            projectId: config.projectId as string | undefined,
          });

          externalId = issue.identifier;
          break;
        }

        case "GOOGLE_CALENDAR": {
          const draft: CalendarEventDraft = {
            title: output.title || "Meeting",
            description: content,
            startTime: metadata.startTime as string | undefined,
            duration: metadata.duration as number | undefined,
            attendees: metadata.attendees as string[] | undefined,
            location: metadata.location as string | undefined,
            sourceSnippet: output.sourceSnippet || "",
          };

          const event = await createCalendarEvent(orgId, user.id, draft, {
            calendarId: config.calendarId as string | undefined,
          });

          externalId = event.id;
          break;
        }

        case "NOTION": {
          const draft: MeetingNotesDraft = {
            title: output.title || "Meeting Notes",
            content,
            sections: (metadata.sections as Array<{ heading: string; content: string }>) || [],
            attendees: (metadata.attendees as string[]) || [],
            actionItems: (metadata.actionItems as string[]) || [],
            keyDecisions: (metadata.keyDecisions as string[]) || [],
          };

          const page = await createNotionPage(orgId, draft, {
            databaseId: config.databaseId as string | undefined,
            parentPageId: config.parentPageId as string | undefined,
          });

          externalId = page.id;
          break;
        }

        default:
          return NextResponse.json(
            { error: { code: "NOT_IMPLEMENTED", message: `Platform ${output.destinationPlatform} not yet supported` } },
            { status: 501 }
          );
      }

      // Update output with push result
      const updated = await prisma.draftedOutput.update({
        where: { id: outputId },
        data: {
          status: "PUSHED",
          pushedAt: new Date(),
          externalId,
        },
      });

      // Audit log
      await createAuditLog({
        orgId,
        userId: user.id,
        action: "CREATE",
        resource: "INTEGRATION_PUSH",
        resourceId: outputId,
        details: {
          conversationId: id,
          outputType: output.outputType,
          platform: output.destinationPlatform,
          externalId,
        },
      });

      return NextResponse.json({
        success: true,
        output: updated,
        externalId,
      });
    } catch (pushError) {
      // Update output with error
      await prisma.draftedOutput.update({
        where: { id: outputId },
        data: {
          status: "FAILED",
          pushError: pushError instanceof Error ? pushError.message : "Push failed",
        },
      });

      return NextResponse.json(
        { error: { code: "PUSH_FAILED", message: pushError instanceof Error ? pushError.message : "Push failed" } },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error pushing output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to push output" } },
      { status: 500 }
    );
  }
}
