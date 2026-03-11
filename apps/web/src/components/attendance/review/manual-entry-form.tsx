"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceType } from "@prisma/client";

interface ManualEntryFormProps {
  programId: string;
  sessionId: string;
  onComplete: () => void;
}

interface EnrolledClient {
  enrollmentId: string;
  clientName: string;
  attendanceType: AttendanceType;
  hoursAttended: string;
  notes: string;
}

export function ManualEntryForm({
  programId,
  sessionId,
  onComplete,
}: ManualEntryFormProps) {
  const [clients, setClients] = useState<EnrolledClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        const response = await fetch(
          `/api/programs/${programId}/sessions/${sessionId}/attendance?format=sheet`
        );
        if (response.ok) {
          const data = await response.json();
          const enrollments = data.data?.enrollments || data.data || [];
          setClients(
            enrollments.map((e: { enrollmentId: string; clientName: string }) => ({
              enrollmentId: e.enrollmentId,
              clientName: e.clientName,
              attendanceType: "PRESENT" as AttendanceType,
              hoursAttended: "",
              notes: "",
            }))
          );
        }
      } catch {
        toast.error("Failed to load enrollments");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEnrollments();
  }, [programId, sessionId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const records = clients.map((c) => ({
        enrollmentId: c.enrollmentId,
        attended: c.attendanceType !== "ABSENT",
        hoursAttended: c.hoursAttended ? parseFloat(c.hoursAttended) : null,
        notes: c.notes || null,
      }));

      const response = await fetch(
        `/api/programs/${programId}/sessions/${sessionId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to save");
      }

      toast.success("Attendance recorded");
      onComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save attendance"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateClient = (
    index: number,
    updates: Partial<EnrolledClient>
  ) => {
    setClients((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onComplete}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Manual Attendance Entry</CardTitle>
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting || clients.length === 0}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            No enrolled clients found
          </p>
        ) : (
          <div className="space-y-2">
            {clients.map((client, index) => (
              <div
                key={client.enrollmentId}
                className="flex items-center gap-3 p-3 rounded-md border"
              >
                <span className="font-medium text-sm min-w-[150px]">
                  {client.clientName}
                </span>
                <Select
                  value={client.attendanceType}
                  onValueChange={(val) =>
                    updateClient(index, {
                      attendanceType: val as AttendanceType,
                    })
                  }
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  className="w-[80px] h-8 text-xs"
                  placeholder="Hours"
                  value={client.hoursAttended}
                  onChange={(e) =>
                    updateClient(index, { hoursAttended: e.target.value })
                  }
                />
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="Notes"
                  value={client.notes}
                  onChange={(e) =>
                    updateClient(index, { notes: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
