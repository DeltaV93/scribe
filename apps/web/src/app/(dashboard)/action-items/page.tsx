"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  ListChecks,
  Calendar,
  AlertCircle,
  ExternalLink,
  Phone,
  Bell,
  Users,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import type { ReminderStatus, DraftStatus } from "@prisma/client";

interface ActionItem {
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

const statusConfig = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
};

export default function ActionItemsPage() {
  const router = useRouter();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const limit = 20;

  const fetchActionItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (sourceFilter && sourceFilter !== "all") {
        params.set("source", sourceFilter);
      }
      params.set("limit", limit.toString());
      params.set("offset", ((page - 1) * limit).toString());

      const response = await fetch(`/api/action-items?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setActionItems(data.data);
        setTotal(data.total);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(
          errorData.error?.message ||
            "Failed to load tasks. Please try again."
        );
      }
    } catch (err) {
      console.error("Error fetching action items:", err);
      setError(
        "Unable to connect to the server. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, sourceFilter, page]);

  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  const handleStatusChange = async (item: ActionItem, newStatus: "OPEN" | "IN_PROGRESS" | "COMPLETED") => {
    if (newStatus === item.status) return;
    setUpdatingItemId(item.id);
    setError(null);

    try {
      let response: Response;

      if (item.source === "reminder") {
        // For reminders, use different endpoints for complete vs reopen
        if (newStatus === "COMPLETED") {
          response = await fetch(`/api/reminders/${item.id}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } else {
          // Reopen: set status back to PENDING
          response = await fetch(`/api/reminders/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PENDING" }),
          });
        }
      } else if (item.source === "conversation" && item.conversation) {
        // For conversation outputs, use approve/reopen endpoints
        if (newStatus === "COMPLETED") {
          response = await fetch(
            `/api/conversations/${item.conversation.id}/outputs/${item.id}/approve`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
        } else {
          // Reopen: set status back to PENDING
          response = await fetch(
            `/api/conversations/${item.conversation.id}/outputs/${item.id}/reopen`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } else {
        // Use appropriate endpoint based on source (call or meeting)
        const endpoint =
          item.source === "call"
            ? `/api/action-items/${item.id}`
            : `/api/meetings/${item.meeting?.id}/action-items`;

        const body =
          item.source === "call"
            ? { status: newStatus }
            : { actionItemId: item.id, status: newStatus };

        response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error?.message || "Failed to update task");
        return;
      }

      // Refresh the list
      fetchActionItems();
    } catch (err) {
      console.error("Error updating task:", err);
      setError("Failed to update task. Please try again.");
    } finally {
      setUpdatingItemId(null);
    }
  };

  const formatSourceDate = (item: ActionItem) => {
    if (item.source === "call" && item.call) {
      return format(new Date(item.call.createdAt), "MMM d, yyyy");
    }
    if (item.source === "meeting" && item.meeting) {
      const date = item.meeting.actualStartAt || item.meeting.scheduledStartAt;
      if (!date) return null;
      return format(new Date(date), "MMM d, yyyy");
    }
    return null;
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const isOverdue = date < now;
    const formattedDate = format(date, "MMM d, yyyy");

    return { formattedDate, isOverdue };
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">
            Tasks assigned to you from calls, meetings, and reminders.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="call">Calls</SelectItem>
            <SelectItem value="meeting">Meetings</SelectItem>
            <SelectItem value="conversation">Conversations</SelectItem>
            <SelectItem value="reminder">Reminders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error State */}
      {error && (
        <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchActionItems}>
            Try Again
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[130px]">Due Date</TableHead>
              <TableHead className="w-[200px]">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : actionItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tasks found</p>
                    <p className="text-sm">
                      {statusFilter !== "all" || sourceFilter !== "all"
                        ? "Try changing the filters."
                        : "Tasks assigned to you from calls, meetings, and reminders will appear here."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              actionItems.map((item) => {
                const dueInfo = formatDueDate(item.dueDate);
                const isUpdating = updatingItemId === item.id;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : item.status === "CANCELLED" ? (
                          <Checkbox checked={false} disabled />
                        ) : (
                          <Select
                            value={item.status}
                            onValueChange={(value) =>
                              handleStatusChange(
                                item,
                                value as "OPEN" | "IN_PROGRESS" | "COMPLETED"
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent justify-center [&>svg]:hidden">
                              <Checkbox
                                checked={item.status === "COMPLETED"}
                                className={
                                  item.status === "IN_PROGRESS"
                                    ? "data-[state=unchecked]:bg-yellow-100 data-[state=unchecked]:border-yellow-500"
                                    : ""
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OPEN">Open</SelectItem>
                              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className={
                          item.status === "COMPLETED"
                            ? "line-through text-muted-foreground"
                            : ""
                        }
                      >
                        <p className="font-medium">{item.description}</p>
                        {item.contextSnippet && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm text-muted-foreground truncate max-w-md cursor-help">
                                  {item.contextSnippet}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="max-w-sm"
                              >
                                <p>{item.contextSnippet}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[item.status].color}>
                        {statusConfig[item.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dueInfo ? (
                        <div
                          className={`flex items-center gap-1 text-sm ${
                            dueInfo.isOverdue && item.status !== "COMPLETED"
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Calendar className="h-4 w-4" />
                          {dueInfo.formattedDate}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.source === "call" && item.call ? (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/calls/${item.call!.id}`)
                            }
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">
                              Call
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </button>
                          {formatSourceDate(item) && (
                            <p className="text-xs text-muted-foreground">
                              {formatSourceDate(item)}
                            </p>
                          )}
                        </>
                      ) : item.source === "meeting" && item.meeting ? (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/meetings/${item.meeting!.id}`)
                            }
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <span className="truncate max-w-[150px]">
                              {item.meeting.title}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </button>
                          {formatSourceDate(item) && (
                            <p className="text-xs text-muted-foreground">
                              {formatSourceDate(item)}
                            </p>
                          )}
                        </>
                      ) : item.source === "conversation" && item.conversation ? (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/conversations/${item.conversation!.id}`)
                            }
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <MessageSquare className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">
                              {item.conversation.title || "Conversation"}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.conversation.startedAt), "MMM d, yyyy")}
                          </p>
                        </>
                      ) : item.source === "reminder" && item.reminder ? (
                        <>
                          <button
                            onClick={() =>
                              router.push(`/clients/${item.reminder!.clientId}`)
                            }
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Bell className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">
                              Reminder
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </button>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.reminder.clientName}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
