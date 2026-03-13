/**
 * Conversation Output Push Service (PX-882)
 *
 * Handles pushing drafted outputs to external platforms.
 * Used by both the push endpoint and auto-push on approve.
 */

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import { getAccessToken } from "@/lib/integrations/base/token-store";
import { getWorkflowServiceAsync, hasWorkflowService } from "@/lib/integrations/base/registry";
import { createLinearIssue } from "@/lib/integrations/linear";
import { createCalendarEvent } from "@/lib/integrations/google-calendar";
import { createNotionPage } from "@/lib/integrations/notion";
import type {
  ActionItemDraft,
  CalendarEventDraft,
  MeetingNotesDraft,
} from "@/lib/services/workflow-outputs";
import type { IntegrationPlatform } from "@prisma/client";

export interface PushContext {
  orgId: string;
  userId: string;
  conversationId: string;
}

export interface PushOutputResult {
  success: boolean;
  externalId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Check if a platform is connected for an organization
 */
export async function isPlatformConnected(
  orgId: string,
  platform: IntegrationPlatform
): Promise<boolean> {
  const token = await getAccessToken(orgId, platform);
  return token !== null;
}

/**
 * Push a single drafted output to its destination platform
 *
 * Returns the result without updating the database.
 * Caller is responsible for updating output status.
 */
export async function pushOutput(
  outputId: string,
  context: PushContext
): Promise<PushOutputResult> {
  const output = await prisma.draftedOutput.findUnique({
    where: { id: outputId },
    include: {
      conversation: {
        select: { orgId: true },
      },
    },
  });

  if (!output) {
    return { success: false, error: "Output not found", errorCode: "NOT_FOUND" };
  }

  if (!output.destinationPlatform) {
    return {
      success: false,
      error: "No destination platform configured",
      errorCode: "NO_PLATFORM",
    };
  }

  const { orgId, userId } = context;
  const platform = output.destinationPlatform as IntegrationPlatform;
  const content = output.editedContent || output.content;
  const metadata = (output.metadata as Record<string, unknown>) || {};
  const config = (output.destinationConfig as Record<string, unknown>) || {};

  // Check if platform is connected
  const accessToken = await getAccessToken(orgId, platform);
  if (!accessToken) {
    return {
      success: false,
      error: `${platform} is not connected. Please connect it in Settings > Integrations.`,
      errorCode: "NOT_CONNECTED",
    };
  }

  let externalId: string | undefined;

  try {
    // Use workflow service for LINEAR, NOTION, JIRA
    if (hasWorkflowService(platform)) {
      const service = await getWorkflowServiceAsync(platform);

      if (output.outputType === "ACTION_ITEM" || output.outputType === "DELAY_SIGNAL") {
        const draft: ActionItemDraft = {
          title: output.title || "Action Item",
          description: content,
          assignee: metadata.assignee as string | undefined,
          dueDate: metadata.dueDate as string | undefined,
          priority: metadata.priority as "low" | "medium" | "high" | "urgent" | undefined,
          labels: metadata.labels as string[] | undefined,
          sourceSnippet: output.sourceSnippet || "",
        };

        const result = await service.pushActionItem(accessToken, draft, config);

        if (!result.success) {
          return {
            success: false,
            error: result.error || "Push failed",
            errorCode: result.errorCode,
          };
        }

        externalId = result.externalId;
      } else if (output.outputType === "MEETING_NOTES" || output.outputType === "DOCUMENT") {
        if (!service.pushMeetingNotes) {
          return {
            success: false,
            error: `${platform} does not support meeting notes`,
            errorCode: "NOT_SUPPORTED",
          };
        }

        const draft: MeetingNotesDraft = {
          title: output.title || "Meeting Notes",
          content,
          sections: (metadata.sections as Array<{ heading: string; content: string }>) || [],
          attendees: (metadata.attendees as string[]) || [],
          actionItems: (metadata.actionItems as string[]) || [],
          keyDecisions: (metadata.keyDecisions as string[]) || [],
        };

        const result = await service.pushMeetingNotes(accessToken, draft, config);

        if (!result.success) {
          return {
            success: false,
            error: result.error || "Push failed",
            errorCode: result.errorCode,
          };
        }

        externalId = result.externalId;
      } else {
        return {
          success: false,
          error: `Output type ${output.outputType} not supported for ${platform}`,
          errorCode: "NOT_SUPPORTED",
        };
      }
    } else if (platform === "GOOGLE_CALENDAR") {
      // Google Calendar uses its own pattern
      const draft: CalendarEventDraft = {
        title: output.title || "Meeting",
        description: content,
        startTime: metadata.startTime as string | undefined,
        duration: metadata.duration as number | undefined,
        attendees: metadata.attendees as string[] | undefined,
        location: metadata.location as string | undefined,
        sourceSnippet: output.sourceSnippet || "",
      };

      const event = await createCalendarEvent(orgId, userId, draft, {
        calendarId: config.calendarId as string | undefined,
      });

      externalId = event.id;
    } else {
      return {
        success: false,
        error: `Platform ${platform} not supported`,
        errorCode: "NOT_IMPLEMENTED",
      };
    }

    // Create audit log
    await createAuditLog({
      orgId,
      userId,
      action: "CREATE",
      resource: "INTEGRATION_PUSH",
      resourceId: outputId,
      details: {
        conversationId: context.conversationId,
        outputType: output.outputType,
        platform,
        externalId,
      },
    });

    return { success: true, externalId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: "EXCEPTION",
    };
  }
}

/**
 * Push output and update its status in the database
 */
export async function pushOutputAndUpdateStatus(
  outputId: string,
  context: PushContext
): Promise<PushOutputResult> {
  const result = await pushOutput(outputId, context);

  if (result.success) {
    await prisma.draftedOutput.update({
      where: { id: outputId },
      data: {
        status: "PUSHED",
        pushedAt: new Date(),
        externalId: result.externalId,
        pushError: null,
      },
    });
  } else {
    await prisma.draftedOutput.update({
      where: { id: outputId },
      data: {
        status: "FAILED",
        pushError: result.error,
      },
    });
  }

  return result;
}

/**
 * Auto-push an output after approval
 *
 * Only pushes if:
 * 1. Output has a destination platform
 * 2. Platform is connected
 *
 * Failures are recorded but don't block approval.
 * Returns result for UI display.
 */
export async function autoPushAfterApproval(
  outputId: string,
  context: PushContext
): Promise<PushOutputResult | null> {
  const output = await prisma.draftedOutput.findUnique({
    where: { id: outputId },
    select: {
      destinationPlatform: true,
    },
  });

  if (!output?.destinationPlatform) {
    // No platform configured, nothing to push
    return null;
  }

  const platform = output.destinationPlatform as IntegrationPlatform;

  // Check if platform is connected
  const isConnected = await isPlatformConnected(context.orgId, platform);
  if (!isConnected) {
    // Platform not connected, don't auto-push
    return null;
  }

  // Push and update status
  return pushOutputAndUpdateStatus(outputId, context);
}
