"use client";

/**
 * Quick Action FAB (Floating Action Button)
 *
 * Primary entry point for quick actions. Fixed position at bottom-right.
 * WCAG AAA compliant with proper focus management.
 */

import { useAtom, useSetAtom } from "jotai";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isQuickActionSheetOpenAtom,
  openQuickActionSheetAtom,
} from "@/lib/quick-actions/atoms";
import { useQuickActions, useQuickActionKeyboard } from "@/lib/quick-actions/hooks";
import { trackQuickActionEvent } from "@/lib/quick-actions/analytics";
import type { UserRole } from "@/types";

interface QuickActionFABProps {
  /** User role for permission filtering */
  userRole: UserRole;
  /** Whether the FAB is visible (from user preferences) */
  visible?: boolean;
  className?: string;
}

export function QuickActionFAB({ userRole, visible = true, className }: QuickActionFABProps) {
  const [isOpen] = useAtom(isQuickActionSheetOpenAtom);
  const openSheet = useSetAtom(openQuickActionSheetAtom);
  const actions = useQuickActions(userRole);

  // Register keyboard shortcut (Cmd/Ctrl+K)
  useQuickActionKeyboard();

  function handleClick() {
    trackQuickActionEvent("FAB_CLICKED");
    openSheet();
  }

  // Don't render if hidden by user preference or no actions available
  if (!visible || actions.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      size="icon-lg"
      className={cn(
        "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg",
        "transition-transform duration-200 ease-out",
        "hover:scale-105 active:scale-95",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-reduce:transition-none motion-reduce:hover:scale-100",
        // Safe area for mobile devices with notches/home indicators
        "mb-safe",
        className
      )}
      aria-label="Quick actions"
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <Plus
        className={cn(
          "h-6 w-6 transition-transform duration-200",
          "motion-reduce:transition-none",
          isOpen && "rotate-45"
        )}
        aria-hidden="true"
      />
    </Button>
  );
}
