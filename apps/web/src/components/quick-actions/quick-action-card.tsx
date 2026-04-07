"use client";

/**
 * Quick Action Card
 *
 * Individual action card within the quick action sheet.
 * Accessible with keyboard navigation and screen reader support.
 */

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  isFocused: boolean;
  onClick: () => void;
}

export const QuickActionCard = forwardRef<HTMLButtonElement, QuickActionCardProps>(
  function QuickActionCard({ icon: Icon, label, description, isFocused, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-4 rounded-lg p-4 text-left",
          "transition-colors duration-150",
          "hover:bg-muted",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "motion-reduce:transition-none",
          isFocused && "bg-muted"
        )}
        tabIndex={isFocused ? 0 : -1}
        aria-label={`${label}: ${description}`}
      >
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </button>
    );
  }
);
