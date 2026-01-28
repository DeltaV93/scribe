"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface BatchGenerateDialogProps {
  programId: string;
  programName: string;
  trigger?: React.ReactNode;
}

interface GenerationResult {
  generated: {
    sessionId: string;
    sessionNumber: number;
    uploadId: string;
    fileName: string;
  }[];
  failed: {
    sessionId: string;
    sessionNumber: number;
    error: string;
  }[];
}

export function BatchGenerateDialog({
  programId,
  programName,
  trigger,
}: BatchGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [result, setResult] = useState<GenerationResult | null>(null);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      toast.error("Start date must be before end date");
      return;
    }

    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 30) {
      toast.error("Date range cannot exceed 30 days");
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await fetch("/api/attendance/batch-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to batch generate attendance sheets");
      }

      const data = await response.json();
      setResult({
        generated: data.data.generated,
        failed: data.data.failed,
      });

      if (data.data.generated.length > 0) {
        toast.success(
          `Generated ${data.data.generated.length} attendance sheet(s)`
        );
      }

      if (data.data.failed.length > 0) {
        toast.warning(`${data.data.failed.length} sheet(s) failed to generate`);
      }
    } catch (error) {
      console.error("Error batch generating sheets:", error);
      toast.error("Failed to batch generate attendance sheets");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setStartDate("");
    setEndDate("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Batch Generate Sheets
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Batch Generate Attendance Sheets</DialogTitle>
          <DialogDescription>
            Generate attendance sheets for all sessions in {programName} within a
            date range.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            {result.generated.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Successfully Generated ({result.generated.length})
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  {result.generated.map((item) => (
                    <li key={item.sessionId}>
                      Session #{item.sessionNumber}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.failed.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center">
                  <XCircle className="mr-2 h-4 w-4" />
                  Failed ({result.failed.length})
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  {result.failed.map((item) => (
                    <li key={item.sessionId}>
                      Session #{item.sessionNumber}: {item.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Sheets will be generated for all sessions with dates within this
                range. Maximum range is 30 days.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Sheets"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
