"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReminderStatus } from "@prisma/client";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Check, Clock, AlertTriangle, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReminderCardProps {
  reminder: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    status: ReminderStatus;
    priority: number;
    client?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
    assignedTo?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
  onAcknowledge?: () => void;
  onComplete?: () => void;
  onClick?: () => void;
  showClient?: boolean;
  showAssignee?: boolean;
  className?: string;
}

const statusConfig: Record<
  ReminderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  PENDING: { label: "Pending", variant: "secondary" },
  SENT: { label: "Sent", variant: "default" },
  ACKNOWLEDGED: { label: "Acknowledged", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const priorityConfig: Record<number, { label: string; className: string }> = {
  1: { label: "High", className: "border-l-red-500" },
  2: { label: "Normal", className: "border-l-blue-500" },
  3: { label: "Low", className: "border-l-gray-300" },
};

export function ReminderCard({
  reminder,
  onAcknowledge,
  onComplete,
  onClick,
  showClient = true,
  showAssignee = false,
  className,
}: ReminderCardProps) {
  const dueDate = new Date(reminder.dueDate);
  const isOverdue = isPast(dueDate) && reminder.status !== "COMPLETED" && reminder.status !== "CANCELLED";
  const statusInfo = statusConfig[reminder.status];
  const priorityInfo = priorityConfig[reminder.priority] || priorityConfig[2];

  const formatDueDate = () => {
    if (isToday(dueDate)) return "Today";
    if (isTomorrow(dueDate)) return "Tomorrow";
    if (isPast(dueDate)) {
      const days = differenceInDays(new Date(), dueDate);
      return `${days} day${days > 1 ? "s" : ""} overdue`;
    }
    const days = differenceInDays(dueDate, new Date());
    if (days <= 7) return `In ${days} day${days > 1 ? "s" : ""}`;
    return format(dueDate, "MMM d, yyyy");
  };

  const clientName = reminder.client
    ? `${reminder.client.firstName || ""} ${reminder.client.lastName || ""}`.trim() || "Unknown Client"
    : null;

  const assigneeName = reminder.assignedTo
    ? reminder.assignedTo.name || reminder.assignedTo.email
    : null;

  const canAcknowledge = reminder.status === "PENDING" || reminder.status === "SENT";
  const canComplete = reminder.status !== "COMPLETED" && reminder.status !== "CANCELLED";

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors border-l-4",
        priorityInfo.className,
        isOverdue && "border-l-red-500",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{reminder.title}</h4>
              <Badge variant={statusInfo.variant} className="flex-shrink-0">
                {statusInfo.label}
              </Badge>
            </div>

            {reminder.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {reminder.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div
                className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-destructive font-medium"
                )}
              >
                {isOverdue ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {formatDueDate()}
              </div>

              {showClient && clientName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {clientName}
                </div>
              )}

              {showAssignee && assigneeName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {assigneeName}
                </div>
              )}
            </div>
          </div>

          {(onAcknowledge || onComplete) && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {canAcknowledge && onAcknowledge && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAcknowledge}
                  title="Acknowledge"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              )}
              {canComplete && onComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onComplete}
                  title="Mark Complete"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
