"use client";

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
import { MicOff, AlertTriangle } from "lucide-react";

interface ConsentWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  onProceed: () => void;
  onCancel: () => void;
}

export function ConsentWarningModal({
  open,
  onOpenChange,
  clientName,
  onProceed,
  onCancel,
}: ConsentWarningModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <MicOff className="h-5 w-5 text-warning" />
            </div>
            <AlertDialogTitle>Recording Consent Revoked</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <p>
                  <strong>{clientName}</strong> has opted out of call recording.
                  This call will <strong>not be recorded</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                If you proceed, you will need to manually document this call
                after it ends. AI transcription and form auto-population will
                not be available.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel Call</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>
            Proceed Unrecorded
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
