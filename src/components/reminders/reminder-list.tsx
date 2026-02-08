"use client";

import { useState, useEffect } from "react";
import { ReminderCard } from "./reminder-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReminderStatus } from "@prisma/client";
import { Loader2, Plus, Search, Bell } from "lucide-react";
import { toast } from "sonner";

interface Reminder {
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
}

interface ReminderListProps {
  clientId?: string;
  myOnly?: boolean;
  onCreateClick?: () => void;
  onReminderClick?: (reminder: Reminder) => void;
}

export function ReminderList({
  clientId,
  myOnly = true,
  onCreateClick,
  onReminderClick,
}: ReminderListProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchReminders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (myOnly) params.set("my", "true");
      if (clientId) params.set("clientId", clientId);
      if (status && status !== "all") params.set("status", status);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const baseUrl = clientId ? `/api/clients/${clientId}/reminders` : "/api/reminders";
      const response = await fetch(`${baseUrl}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReminders(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [status, pagination.page, clientId, myOnly]);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleAcknowledge = async (reminderId: string) => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}/acknowledge`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Reminder acknowledged");
        fetchReminders();
      } else {
        throw new Error("Failed to acknowledge reminder");
      }
    } catch (error) {
      toast.error("Failed to acknowledge reminder");
    }
  };

  const handleComplete = async (reminderId: string) => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}/complete`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Reminder completed");
        fetchReminders();
      } else {
        throw new Error("Failed to complete reminder");
      }
    } catch (error) {
      toast.error("Failed to complete reminder");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4 flex-1 flex-wrap">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={ReminderStatus.PENDING}>Pending</SelectItem>
              <SelectItem value={ReminderStatus.ACKNOWLEDGED}>Acknowledged</SelectItem>
              <SelectItem value={ReminderStatus.COMPLETED}>Completed</SelectItem>
              <SelectItem value={ReminderStatus.OVERDUE}>Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {onCreateClick && (
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            New Reminder
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No reminders</h3>
          <p className="text-muted-foreground">
            {status === "all"
              ? "You don't have any reminders yet."
              : "No reminders match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onClick={() => onReminderClick?.(reminder)}
              onAcknowledge={() => handleAcknowledge(reminder.id)}
              onComplete={() => handleComplete(reminder.id)}
              showClient={!clientId}
              showAssignee={!myOnly}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
