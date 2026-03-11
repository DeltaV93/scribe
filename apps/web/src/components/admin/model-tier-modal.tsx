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
import { Shield, Users } from "lucide-react";
import type { ModelTier } from "@/lib/ml-services/types";

interface ModelTierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: ModelTier;
  newTier: ModelTier | null;
  onConfirm: () => void;
}

export function ModelTierModal({
  open,
  onOpenChange,
  currentTier,
  newTier,
  onConfirm,
}: ModelTierModalProps) {
  if (!newTier) return null;

  const isUpgradingToPrivate = newTier === "private";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isUpgradingToPrivate ? (
              <Shield className="h-5 w-5 text-primary" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
            Switch to {newTier === "private" ? "Private" : "Shared"} Model?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            {isUpgradingToPrivate ? (
              <>
                <p>
                  Switching to <strong>Private Model</strong> means:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>
                    Your organization's data will <strong>only</strong> be used for
                    your private models
                  </li>
                  <li>
                    You will not contribute to or benefit from global model
                    improvements
                  </li>
                  <li>
                    Data sharing consent will be automatically revoked
                  </li>
                  <li>
                    Your models may have less training data available
                  </li>
                </ul>
                <p className="text-sm font-medium">
                  This change provides maximum data isolation but may affect model
                  performance.
                </p>
              </>
            ) : (
              <>
                <p>
                  Switching to <strong>Shared Model</strong> means:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>
                    Your anonymized data may contribute to global model training
                    (with consent)
                  </li>
                  <li>
                    You benefit from improvements made across the platform
                  </li>
                  <li>
                    Data is anonymized using differential privacy techniques
                  </li>
                  <li>
                    You can enable or disable data sharing consent separately
                  </li>
                </ul>
                <p className="text-sm font-medium">
                  This change enables better model performance through shared
                  learning.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Switch to {newTier === "private" ? "Private" : "Shared"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
