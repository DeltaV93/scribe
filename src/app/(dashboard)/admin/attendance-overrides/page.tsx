"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingOverridesList } from "@/components/attendance/override/pending-overrides-list";
import { OverrideApprovalDialog } from "@/components/attendance/override/override-approval-dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Override {
  id: string;
  sessionId: string;
  status: string;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
  session: {
    id: string;
    sessionNumber: number;
    title: string;
    date: string | null;
    program: { id: string; name: string };
  };
  uploadedBy: { id: string; name: string | null; email: string };
}

export default function AttendanceOverridesPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOverride, setSelectedOverride] = useState<Override | null>(null);

  const fetchOverrides = async () => {
    try {
      const response = await fetch("/api/attendance/overrides");
      if (response.ok) {
        const data = await response.json();
        setOverrides(data.data || []);
      }
    } catch {
      toast.error("Failed to load overrides");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Attendance Override Requests
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests ({overrides.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PendingOverridesList
            overrides={overrides}
            onAction={(override) => setSelectedOverride(override)}
          />
        </CardContent>
      </Card>

      {selectedOverride && (
        <OverrideApprovalDialog
          uploadId={selectedOverride.id}
          programId={selectedOverride.session.program.id}
          sessionId={selectedOverride.sessionId}
          open={!!selectedOverride}
          onOpenChange={(open) => !open && setSelectedOverride(null)}
          onCompleted={() => {
            setSelectedOverride(null);
            fetchOverrides();
          }}
        />
      )}
    </div>
  );
}
