"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Send } from "lucide-react";

interface ShareableWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

const DEFAULT_GUIDELINES = [
  "Content is appropriate for client viewing",
  "No internal jargon or abbreviations",
  "No sensitive staff-only information included",
  "Grammar and spelling have been reviewed",
  "Information is accurate and factual",
];

export function ShareableWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: ShareableWarningDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [guidelines, setGuidelines] = useState<string[]>(DEFAULT_GUIDELINES);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch org-specific guidelines on mount
  useEffect(() => {
    const fetchGuidelines = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings/shareable-note-guidelines");
        if (response.ok) {
          const data = await response.json();
          if (data.data?.guidelines && data.data.guidelines.length > 0) {
            setGuidelines(data.data.guidelines);
          }
        }
      } catch (error) {
        // Use default guidelines on error
        console.error("Error fetching guidelines:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      fetchGuidelines();
      // Reset acknowledgment when dialog opens
      setAcknowledged(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (acknowledged) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Submit for Approval
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            This note will be reviewed by a supervisor before becoming visible to
            the client. Please confirm the following:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Content Guidelines:</p>
                <ul className="space-y-1.5">
                  {guidelines.map((guideline, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="text-primary mt-0.5">•</span>
                      {guideline}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                <Checkbox
                  id="acknowledge-guidelines"
                  checked={acknowledged}
                  onCheckedChange={(checked) =>
                    setAcknowledged(checked === true)
                  }
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="acknowledge-guidelines"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I confirm this note follows the content guidelines and is
                  appropriate for client viewing.
                </Label>
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!acknowledged || isSubmitting || isLoading}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit for Approval
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
