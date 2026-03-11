"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingOverridesList } from "@/components/attendance/override/pending-overrides-list";
import { OverrideApprovalDialog } from "@/components/attendance/override/override-approval-dialog";
import { Loader2, ClipboardCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Attendance Override Requests
          </h1>
          <p className="text-muted-foreground">
            Review and approve attendance sheet corrections
          </p>
        </div>
        <Button variant="outline" onClick={fetchOverrides}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>
            {overrides.length === 0
              ? "No pending override requests to review"
              : `${overrides.length} request${overrides.length === 1 ? "" : "s"} awaiting review`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No pending override requests
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                When staff submit attendance corrections, they will appear here for review.
              </p>
            </div>
          ) : (
            <PendingOverridesList
              overrides={overrides}
              onAction={(override) => setSelectedOverride(override)}
            />
          )}
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
