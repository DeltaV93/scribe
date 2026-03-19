"use client";

/**
 * Quick Action Sheet
 *
 * Slide-up sheet containing quick action options.
 * Mobile-first design with full keyboard accessibility.
 */

import { useEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { QuickActionCard } from "./quick-action-card";
import {
  isQuickActionSheetOpenAtom,
  closeQuickActionSheetAtom,
} from "@/lib/quick-actions/atoms";
import {
  useQuickActions,
  useQuickActionNavigation,
} from "@/lib/quick-actions/hooks";
import { trackQuickActionEvent } from "@/lib/quick-actions/analytics";
import type { UserRole } from "@/types";

interface QuickActionSheetProps {
  /** User role for permission filtering */
  userRole: UserRole;
}

export function QuickActionSheet({ userRole }: QuickActionSheetProps) {
  const [isOpen] = useAtom(isQuickActionSheetOpenAtom);
  const closeSheet = useSetAtom(closeQuickActionSheetAtom);
  const actions = useQuickActions(userRole);
  const { focusedIndex, handleKeyDown, selectAction } =
    useQuickActionNavigation(actions);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the container when sheet opens for keyboard navigation
  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isOpen]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeSheet();
      trackQuickActionEvent("SHEET_CLOSED");
    }
  }

  // Don't render if no actions available
  if (actions.length === 0) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] w-full rounded-t-2xl pb-safe sm:max-w-lg"
        aria-describedby="quick-action-description"
      >
        <SheetHeader className="text-left">
          <SheetTitle id="quick-action-title">Quick Actions</SheetTitle>
          <SheetDescription id="quick-action-description">
            Choose an action to get started quickly
          </SheetDescription>
        </SheetHeader>

        <div
          ref={containerRef}
          role="menu"
          aria-labelledby="quick-action-title"
          aria-describedby="quick-action-description"
          className="mt-4 space-y-2 outline-none"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {actions.map((action, index) => (
            <QuickActionCard
              key={action.id}
              icon={action.icon}
              label={action.label}
              description={action.description}
              isFocused={index === focusedIndex}
              onClick={() => selectAction(action, "click")}
            />
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <kbd className="rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 font-mono text-xs">
            {typeof navigator !== "undefined" &&
            /Mac|iPod|iPhone|iPad/.test(navigator.platform)
              ? "⌘"
              : "Ctrl"}
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 font-mono text-xs">
            K
          </kbd>{" "}
          to open anytime
        </p>
      </SheetContent>
    </Sheet>
  );
}
