"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface OverrideApprovalDialogProps {
  uploadId: string;
  programId: string;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

export function OverrideApprovalDialog({
  uploadId,
  programId,
  sessionId,
  open,
  onOpenChange,
  onCompleted,
}: OverrideApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadData, setUploadData] = useState<{
    overrideReason: string | null;
    extractedRecords?: { enrollmentId: string; attendanceType: string; enrollment?: { client: { firstName: string; lastName: string } } | null }[];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(
      `/api/programs/${programId}/sessions/${sessionId}/attendance/${uploadId}?format=review`
    )
      .then((r) => r.json())
      .then((d) => setUploadData(d.data))
      .catch(() => {});
  }, [open, uploadId, programId, sessionId]);

  const handleAction = async (action: "approve" | "reject") => {
    setIsSubmitting(true);
    try {
      const body =
        action === "approve"
          ? {
              records: (uploadData?.extractedRecords || []).map((r) => ({
                enrollmentId: r.enrollmentId,
                attendanceType: r.attendanceType || "PRESENT",
              })),
            }
          : { reason };

      const response = await fetch(
        `/api/programs/${programId}/sessions/${sessionId}/attendance/${uploadId}/override?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `Failed to ${action}`);
      }

      toast.success(action === "approve" ? "Override approved" : "Override rejected");
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Override Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {uploadData?.overrideReason && (
            <div>
              <Label className="text-muted-foreground">Override Reason</Label>
              <p className="mt-1 text-sm p-3 rounded-md bg-muted">
                {uploadData.overrideReason}
              </p>
            </div>
          )}

          {uploadData?.extractedRecords && uploadData.extractedRecords.length > 0 && (
            <div>
              <Label className="text-muted-foreground">
                Records ({uploadData.extractedRecords.length})
              </Label>
              <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
                {uploadData.extractedRecords.map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-sm p-2 rounded bg-muted"
                  >
                    <span>
                      {r.enrollment
                        ? `${r.enrollment.client.firstName} ${r.enrollment.client.lastName}`
                        : "Unknown"}
                    </span>
                    <span className="text-muted-foreground">
                      {r.attendanceType || "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reject-reason">Rejection Reason (if rejecting)</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection (min 10 characters)..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              onClick={() => handleAction("reject")}
              disabled={isSubmitting || reason.length < 10}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
            <Button
              onClick={() => handleAction("approve")}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
