"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardList, MicOff } from "lucide-react";

interface UnrecordedCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  callDuration?: string;
  onAddNotes: () => void;
  onCompleteForms: () => void;
  onDismiss: () => void;
}

export function UnrecordedCallModal({
  open,
  onOpenChange,
  clientName,
  callDuration,
  onAddNotes,
  onCompleteForms,
  onDismiss,
}: UnrecordedCallModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <MicOff className="h-5 w-5 text-warning" />
            </div>
            <AlertDialogTitle>Call Not Recorded</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Your call with <strong>{clientName}</strong> was not recorded
                {callDuration && ` (${callDuration})`}.
              </p>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-2">
                  Please document this call manually:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>Add case notes with key discussion points</li>
                  <li>Complete any relevant intake or service forms</li>
                  <li>Log any action items or follow-ups</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onAddNotes}
          >
            <FileText className="mr-2 h-4 w-4" />
            Add Notes
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onCompleteForms}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Complete Forms
          </Button>
          <AlertDialogAction onClick={onDismiss} className="w-full sm:w-auto">
            I&apos;ll do this later
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
