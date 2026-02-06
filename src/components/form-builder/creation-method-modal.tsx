"use client";

import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Sparkles, Upload, PenLine, Check } from "lucide-react";
import type { CreationMethod } from "@/lib/form-builder/store";
import { lastCreationMethodAtom } from "@/lib/form-builder/store";

interface CreationMethodModalProps {
  open: boolean;
  onSelect: (method: CreationMethod) => void;
  showUploadOption: boolean;
}

interface MethodOption {
  id: CreationMethod;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const methods: MethodOption[] = [
  {
    id: "ai",
    icon: Sparkles,
    title: "AI Generate",
    description: "Let AI create form fields based on your requirements",
  },
  {
    id: "upload",
    icon: Upload,
    title: "Upload PDF/Image",
    description: "Extract fields from an existing form document",
  },
  {
    id: "manual",
    icon: PenLine,
    title: "Manual",
    description: "Build your form from scratch, one field at a time",
  },
];

/**
 * Modal for selecting form creation method.
 * Appears when navigating to /forms/new.
 */
export function CreationMethodModal({
  open,
  onSelect,
  showUploadOption,
}: CreationMethodModalProps) {
  const lastMethod = useAtomValue(lastCreationMethodAtom);
  const [selectedMethod, setSelectedMethod] = useState<CreationMethod | null>(
    null
  );

  // Pre-select last used method when modal opens
  useEffect(() => {
    if (open && lastMethod) {
      // Only pre-select if the option is available
      if (lastMethod === "upload" && !showUploadOption) {
        setSelectedMethod(null);
      } else {
        setSelectedMethod(lastMethod);
      }
    }
  }, [open, lastMethod, showUploadOption]);

  // Filter methods based on feature flags
  const availableMethods = methods.filter((method) => {
    if (method.id === "upload" && !showUploadOption) {
      return false;
    }
    return true;
  });

  const handleSelect = (method: CreationMethod) => {
    setSelectedMethod(method);
    // Small delay for visual feedback before closing
    setTimeout(() => {
      onSelect(method);
    }, 150);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl">How would you like to create your form?</DialogTitle>
          <DialogDescription>
            Choose a method to get started. You can always add or modify fields later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {availableMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            const isPreSelected = lastMethod === method.id;

            return (
              <button
                key={method.id}
                onClick={() => handleSelect(method.id)}
                className={cn(
                  "relative flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50 hover:bg-accent",
                  isSelected && "border-primary bg-primary/5",
                  !isSelected && "border-muted"
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{method.title}</span>
                    {isPreSelected && !isSelected && (
                      <span className="text-xs text-muted-foreground">
                        (Last used)
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {method.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute right-4 top-4">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
