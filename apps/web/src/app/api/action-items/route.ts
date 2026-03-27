/**
 * Action Items API (My Tasks)
 *
 * GET /api/action-items - Get action items assigned to the current user
 * Combines action items from calls, meetings, conversations, and reminders into a unified task view
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Prisma,
  ReminderStatus,
  DraftStatus,
  WorkflowOutputType,
} from "@prisma/client";
import {
  reminderToActionItemStatus,
  actionItemStatusToReminderStatuses,
  draftStatusToActionItemStatus,
  actionItemStatusToDraftStatuses,
  numericPriorityToString,
} from "@/lib/services/tasks/status-mapping";

interface UnifiedActionItem {
  id: string;
  description: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  dueDate: string | null;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  contextSnippet: string | null;
  createdAt: string;
  source: "call" | "meeting" | "conversation" | "reminder";
  call?: {
    id: string;
    clientId: string;
    createdAt: string;
  };
  meeting?: {
    id: string;
    title: string;
    actualStartAt: string | null;
    scheduledStartAt: string | null;
  };
  conversation?: {
    id: string;
    title: string | null;
    startedAt: string;
    originalStatus: DraftStatus;
  };
  reminder?: {
    id: string;
    title: string;
    clientId: string;
    clientName: string;
    originalStatus: ReminderStatus;
  };
}

// Convert priority number to string
function priorityToString(priority: number | null | undefined): string {
  if (priority === 1) return "HIGH";
  if (priority === 3) return "LOW";
  return "NORMAL";
}

/**
 * Get action items assigned to the current user
 *
 * Query params:
 * - status: Filter by status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
 * - source: Filter by source (call, meeting, conversation, reminder, or all)
 * - limit: Number of items to return (default 50, max 100)
 * - offset: Number of items to skip (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get("status") as
      | "OPEN"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED"
      | null;
    const sourceFilter = searchParams.get("source") as
      | "call"
      | "meeting"
      | "conversation"
      | "reminder"
      | null;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Validate status if provided
    if (
      status &&
      !["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Invalid status. Must be OPEN, IN_PROGRESS, COMPLETED, or CANCELLED",
          },
        },
        { status: 400 }
      );
    }

    const results: UnifiedActionItem[] = [];

    // Fetch call action items
    if (!sourceFilter || sourceFilter === "call") {
      const callWhere: Prisma.CallActionItemWhereInput = {
        orgId: user.orgId,
        OR: [
          // Directly assigned to user by ID
          { assigneeUserId: user.id },
          // Assigned by name match
          ...(user.name ? [{ assigneeName: user.name }] : []),
          // From calls where user is the case manager (shows unassigned items too)
          { call: { caseManagerId: user.id } },
        ],
        ...(status && { status }),
      };

      const callItems = await prisma.callActionItem.findMany({
        where: callWhere,
        include: {
          call: {
            select: {
              id: true,
              clientId: true,
              createdAt: true,
            },
          },
          assigneeUser: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
      });

      for (const item of callItems) {
        results.push({
          id: item.id,
          description: item.description,
          assigneeName: item.assigneeName,
          assigneeUserId: item.assigneeUserId,
          dueDate: item.dueDate?.toISOString() || null,
          priority: item.priority || "NORMAL",
          status: item.status as UnifiedActionItem["status"],
          contextSnippet: item.contextSnippet,
          createdAt: item.createdAt.toISOString(),
          source: "call",
          call: {
            id: item.call.id,
            clientId: item.call.clientId,
            createdAt: item.call.createdAt.toISOString(),
          },
        });
      }
    }

    // Fetch meeting action items
    if (!sourceFilter || sourceFilter === "meeting") {
      const meetingWhere: Prisma.MeetingActionItemWhereInput = {
        meeting: {
          orgId: user.orgId,
        },
        OR: [
          { assigneeUserId: user.id },
          ...(user.name ? [{ assigneeName: user.name }] : []),
          { assigneeName: user.email },
        ],
        ...(status && { status }),
      };

      const meetingItems = await prisma.meetingActionItem.findMany({
        where: meetingWhere,
        include: {
          meeting: {
            select: {
              id: true,
              title: true,
              actualStartAt: true,
              scheduledStartAt: true,
            },
          },
          assigneeUser: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
      });

      for (const item of meetingItems) {
        results.push({
          id: item.id,
          description: item.description,
          assigneeName: item.assigneeName,
          assigneeUserId: item.assigneeUserId,
          dueDate: item.dueDate?.toISOString() || null,
          priority: "NORMAL", // MeetingActionItem doesn't have priority field
          status: item.status as UnifiedActionItem["status"],
          contextSnippet: item.contextSnippet,
          createdAt: item.createdAt.toISOString(),
          source: "meeting",
          meeting: {
            id: item.meeting.id,
            title: item.meeting.title,
            actualStartAt: item.meeting.actualStartAt?.toISOString() || null,
            scheduledStartAt: item.meeting.scheduledStartAt?.toISOString() || null,
          },
        });
      }
    }

    // Fetch reminders assigned to the current user
    if (!sourceFilter || sourceFilter === "reminder") {
      // Map action item status to reminder statuses for filtering
      const reminderStatuses = status
        ? actionItemStatusToReminderStatuses(status)
        : undefined;

      const reminderWhere: Prisma.ReminderWhereInput = {
        orgId: user.orgId,
        assignedToId: user.id,
        // Exclude completed and cancelled by default unless explicitly filtered
        ...(reminderStatuses
          ? { status: { in: reminderStatuses } }
          : {
              status: {
                in: [
                  ReminderStatus.PENDING,
                  ReminderStatus.SENT,
                  ReminderStatus.ACKNOWLEDGED,
                  ReminderStatus.OVERDUE,
                ],
              },
            }),
      };

      const reminders = await prisma.reminder.findMany({
        where: reminderWhere,
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { priority: "asc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
      });

      for (const reminder of reminders) {
        const clientName = [
          reminder.client.firstName,
          reminder.client.lastName,
        ]
          .filter(Boolean)
          .join(" ");

        results.push({
          id: reminder.id,
          description: reminder.title, // Use title as description for reminders
          assigneeName: reminder.assignedTo.name,
          assigneeUserId: reminder.assignedToId,
          dueDate: reminder.dueDate.toISOString(),
          priority: numericPriorityToString(reminder.priority),
          status: reminderToActionItemStatus(reminder.status),
          contextSnippet: reminder.description, // Use description as context
          createdAt: reminder.createdAt.toISOString(),
          source: "reminder",
          reminder: {
            id: reminder.id,
            title: reminder.title,
            clientId: reminder.client.id,
            clientName,
            originalStatus: reminder.status,
          },
        });
      }
    }

    // Fetch conversation action items (DraftedOutput with ACTION_ITEM type)
    if (!sourceFilter || sourceFilter === "conversation") {
      // Map action item status to draft statuses for filtering
      const draftStatuses = status
        ? actionItemStatusToDraftStatuses(status)
        : undefined;

      const draftWhere: Prisma.DraftedOutputWhereInput = {
        outputType: WorkflowOutputType.ACTION_ITEM,
        conversation: {
          orgId: user.orgId,
          createdById: user.id, // Show action items from conversations user created
        },
        // Filter by status if provided, otherwise show non-completed
        ...(draftStatuses
          ? { status: { in: draftStatuses } }
          : {
              status: {
                in: [DraftStatus.PENDING, DraftStatus.APPROVED, DraftStatus.FAILED],
              },
            }),
      };

      const draftedOutputs = await prisma.draftedOutput.findMany({
        where: draftWhere,
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
              startedAt: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });

      for (const draft of draftedOutputs) {
        // Parse metadata for assignee and due date info
        const metadata = (draft.metadata as Record<string, unknown>) || {};
        const assigneeName = (metadata.assignee as string) || null;
        const dueDate = metadata.dueDate
          ? new Date(metadata.dueDate as string).toISOString()
          : null;
        const priority = (metadata.priority as string) || "NORMAL";

        results.push({
          id: draft.id,
          description: draft.title || draft.content.substring(0, 200),
          assigneeName,
          assigneeUserId: null, // DraftedOutput doesn't link to user
          dueDate,
          priority,
          status: draftStatusToActionItemStatus(draft.status),
          contextSnippet: draft.sourceSnippet,
          createdAt: draft.createdAt.toISOString(),
          source: "conversation",
          conversation: {
            id: draft.conversation.id,
            title: draft.conversation.title,
            startedAt: draft.conversation.startedAt.toISOString(),
            originalStatus: draft.status,
          },
        });
      }
    }

    // Sort combined results by due date (nulls last), then created date
    results.sort((a, b) => {
      // Handle null due dates
      if (!a.dueDate && !b.dueDate) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedResults,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting user action items:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get action items",
        },
      },
      { status: 500 }
    );
  }
}
