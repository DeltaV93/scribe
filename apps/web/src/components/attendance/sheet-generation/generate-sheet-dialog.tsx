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
import { FileDown, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { SheetConfigForm } from "./sheet-config-form";

interface GenerateSheetDialogProps {
  programId: string;
  programName: string;
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  sessionDate?: Date | null;
  config?: {
    includeTimeInOut: boolean;
    includeClientSignature: boolean;
    includeNotes: boolean;
    customInstructions: string | null;
  };
  trigger?: React.ReactNode;
}

export function GenerateSheetDialog({
  programId,
  programName,
  sessionId,
  sessionNumber,
  sessionTitle,
  sessionDate,
  config,
  trigger,
}: GenerateSheetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [customDate, setCustomDate] = useState<string>(
    sessionDate ? sessionDate.toISOString().split("T")[0] : ""
  );

  const handleGenerate = async (download: boolean = true) => {
    setIsGenerating(true);
    try {
      const url = new URL(
        `/api/programs/${programId}/sessions/${sessionId}/attendance/sheet`,
        window.location.origin
      );
      if (download) {
        url.searchParams.set("format", "download");
      }

      const body = customDate
        ? JSON.stringify({ date: new Date(customDate).toISOString() })
        : undefined;

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });

      if (!response.ok) {
        throw new Error("Failed to generate attendance sheet");
      }

      if (download) {
        // Download the PDF
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `attendance-${programName.toLowerCase().replace(/\s+/g, "-")}-session-${sessionNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        toast.success("Attendance sheet downloaded");
      } else {
        const data = await response.json();
        toast.success("Attendance sheet generated", {
          description: `Upload ID: ${data.data.uploadId}`,
        });
      }

      setOpen(false);
    } catch (error) {
      console.error("Error generating sheet:", error);
      toast.error("Failed to generate attendance sheet");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Generate Sheet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Attendance Sheet</DialogTitle>
          <DialogDescription>
            Generate a printable attendance sheet for Session #{sessionNumber}: {sessionTitle}
          </DialogDescription>
        </DialogHeader>

        {showConfig ? (
          <div className="py-4">
            <SheetConfigForm
              programId={programId}
              initialConfig={config}
              onSave={() => setShowConfig(false)}
            />
            <Button
              variant="ghost"
              onClick={() => setShowConfig(false)}
              className="mt-4 w-full"
            >
              Back to Generation
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Sheet Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="Leave blank to use session date"
                />
                <p className="text-xs text-muted-foreground">
                  This date will be printed on the attendance sheet
                </p>
              </div>

              <div className="rounded-md border p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Sheet Settings</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>
                    Time In/Out: {config?.includeTimeInOut !== false ? "Yes" : "No"}
                  </li>
                  <li>
                    Signatures: {config?.includeClientSignature !== false ? "Yes" : "No"}
                  </li>
                  <li>
                    Notes Column: {config?.includeNotes !== false ? "Yes" : "No"}
                  </li>
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfig(true)}
                  className="mt-2 h-auto p-0 text-xs"
                >
                  <Settings className="mr-1 h-3 w-3" />
                  Customize Settings
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleGenerate(false)}
                disabled={isGenerating}
              >
                Generate Only
              </Button>
              <Button onClick={() => handleGenerate(true)} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
