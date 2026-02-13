"use client";

/**
 * Session Status Dropdown (PX-721, PX-724)
 * Inline dropdown for updating session status with confirmation for backward transitions
 */

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  FileEdit,
  CalendarClock,
  Play,
  CheckCircle2,
  XCircle,
  CalendarX2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Session status type from Prisma
type SessionStatus = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELED" | "RESCHEDULED";

interface SessionStatusDropdownProps {
  sessionId: string;
  currentStatus: SessionStatus;
  onStatusChange?: (newStatus: SessionStatus) => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

// Status configuration
const STATUS_CONFIG: Record<
  SessionStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    variant: "default" | "secondary" | "outline" | "destructive";
    color: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    icon: FileEdit,
    variant: "secondary",
    color: "text-muted-foreground",
  },
  SCHEDULED: {
    label: "Scheduled",
    icon: CalendarClock,
    variant: "default",
    color: "text-blue-600",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: Play,
    variant: "default",
    color: "text-green-600",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    variant: "outline",
    color: "text-emerald-600",
  },
  CANCELED: {
    label: "Canceled",
    icon: XCircle,
    variant: "destructive",
    color: "text-red-600",
  },
  RESCHEDULED: {
    label: "Rescheduled",
    icon: CalendarX2,
    variant: "outline",
    color: "text-amber-600",
  },
};

// Status order (for determining "backward" transitions)
const STATUS_ORDER: SessionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
];

function isBackwardTransition(from: SessionStatus, to: SessionStatus): boolean {
  const fromIndex = STATUS_ORDER.indexOf(from);
  const toIndex = STATUS_ORDER.indexOf(to);
  // If either status isn't in the order (CANCELED, RESCHEDULED), it's not a backward transition
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex < fromIndex;
}

export function SessionStatusDropdown({
  sessionId,
  currentStatus,
  onStatusChange,
  disabled = false,
  size = "default",
}: SessionStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    targetStatus: SessionStatus | null;
    reason: string;
  }>({
    open: false,
    targetStatus: null,
    reason: "",
  });

  // Use DRAFT as fallback for unknown statuses
  const currentConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.DRAFT;
  const StatusIcon = currentConfig.icon;

  const handleStatusSelect = async (newStatus: SessionStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false);
      return;
    }

    // Check if this is a backward transition
    if (isBackwardTransition(currentStatus, newStatus)) {
      setConfirmDialog({
        open: true,
        targetStatus: newStatus,
        reason: "",
      });
      setIsOpen(false);
      return;
    }

    // Proceed with status change
    await updateStatus(newStatus);
  };

  const updateStatus = async (newStatus: SessionStatus, reason?: string, confirmBackward = false) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reason,
          confirmBackward,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Handle confirmation required error
        if (error.error?.code === "CONFIRMATION_REQUIRED") {
          setConfirmDialog({
            open: true,
            targetStatus: newStatus,
            reason: "",
          });
          return;
        }
        throw new Error(error.error?.message || "Failed to update status");
      }

      const data = await response.json();
      onStatusChange?.(data.data.status);
    } catch (error) {
      console.error("Error updating session status:", error);
      // Could add toast notification here
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleConfirmBackward = async () => {
    if (!confirmDialog.targetStatus) return;
    await updateStatus(confirmDialog.targetStatus, confirmDialog.reason, true);
    setConfirmDialog({ open: false, targetStatus: null, reason: "" });
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={size}
            disabled={disabled || isLoading}
            className={cn(
              "gap-1.5 px-2",
              size === "sm" && "h-7 text-xs"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <StatusIcon className={cn("h-3.5 w-3.5", currentConfig.color)} />
            )}
            <span className={cn(size === "sm" ? "text-xs" : "text-sm")}>
              {currentConfig.label}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const Icon = config.icon;
            const isBackward = isBackwardTransition(currentStatus, status as SessionStatus);
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusSelect(status as SessionStatus)}
                disabled={status === currentStatus}
                className={cn(
                  "gap-2",
                  status === currentStatus && "bg-accent"
                )}
              >
                <Icon className={cn("h-4 w-4", config.color)} />
                <span>{config.label}</span>
                {isBackward && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    ⚠
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Backward transition confirmation dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              You're moving this session backward from{" "}
              <strong>{STATUS_CONFIG[currentStatus].label}</strong> to{" "}
              <strong>
                {confirmDialog.targetStatus
                  ? STATUS_CONFIG[confirmDialog.targetStatus].label
                  : ""}
              </strong>
              . This action should only be done to correct errors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reason" className="text-sm">
              Reason (optional)
            </Label>
            <Input
              id="reason"
              placeholder="Why is this status change needed?"
              value={confirmDialog.reason}
              onChange={(e) =>
                setConfirmDialog((prev) => ({ ...prev, reason: e.target.value }))
              }
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBackward}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
