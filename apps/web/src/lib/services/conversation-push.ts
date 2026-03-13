/**
 * Conversation Output Push Service (PX-882)
 *
 * Handles pushing drafted outputs to external platforms.
 * Used by both the push endpoint and auto-push on approve.
 */

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import {
  getUserAccessToken,
  hasUserConnection,
  canUserPushToPlatform,
} from "@/lib/integrations/base/user-token-store";
import { getWorkflowServiceAsync, hasWorkflowService } from "@/lib/integrations/base/registry";
import { createCalendarEvent } from "@/lib/integrations/google-calendar";
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
 * Check if a user has connected a workflow platform
 *
 * For workflow platforms (Linear, Notion, Jira), checks user-level connection.
 * For other platforms (Google Calendar), checks org-level connection.
 */
export async function isUserPlatformConnected(
  userId: string,
  orgId: string,
  platform: IntegrationPlatform
): Promise<boolean> {
  // Workflow platforms use per-user connections
  if (hasWorkflowService(platform)) {
    return hasUserConnection(userId, platform);
  }

  // Other platforms (calendar) use org-level connections for now
  // This will be migrated later
  const { getAccessToken } = await import("@/lib/integrations/base/token-store");
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

  let accessToken: string | null = null;

  // For workflow platforms, check user can push and get user token
  if (hasWorkflowService(platform)) {
    const canPush = await canUserPushToPlatform(
      userId,
      orgId,
      platform as "LINEAR" | "NOTION" | "JIRA"
    );
    if (!canPush.canPush) {
      return {
        success: false,
        error: canPush.reason || `Cannot push to ${platform}`,
        errorCode: "USER_NOT_CONNECTED",
      };
    }

    accessToken = await getUserAccessToken(userId, platform);
    if (!accessToken) {
      return {
        success: false,
        error: `Your ${platform} connection has expired. Please reconnect in Settings > Personal > Integrations.`,
        errorCode: "TOKEN_EXPIRED",
      };
    }
  } else {
    // For other platforms (calendar), use org-level token
    const { getAccessToken } = await import("@/lib/integrations/base/token-store");
    accessToken = await getAccessToken(orgId, platform);
    if (!accessToken) {
      return {
        success: false,
        error: `${platform} is not connected. Please connect it in Settings > Integrations.`,
        errorCode: "NOT_CONNECTED",
      };
    }
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

    // Create audit log with user attribution
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
        // For workflow platforms, indicate push was made with user's own credentials
        pushedAsUser: hasWorkflowService(platform) ? userId : undefined,
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
 * For workflow platforms (Linear, Notion, Jira):
 * - Returns null (no auto-push) - user should use explicit "Add to X" button
 * - This ensures proper user attribution and explicit consent
 *
 * For other platforms (Google Calendar):
 * - Auto-pushes if platform is connected
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

  // For workflow platforms, don't auto-push - require explicit user action
  // This ensures proper user attribution in the external system
  if (hasWorkflowService(platform)) {
    return null;
  }

  // For other platforms (e.g., Google Calendar), check if connected and auto-push
  const isConnected = await isUserPlatformConnected(
    context.userId,
    context.orgId,
    platform
  );
  if (!isConnected) {
    // Platform not connected, don't auto-push
    return null;
  }

  // Push and update status
  return pushOutputAndUpdateStatus(outputId, context);
}
