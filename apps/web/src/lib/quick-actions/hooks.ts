"use client";

/**
 * Quick Action Hooks
 *
 * Custom hooks for quick action FAB functionality.
 */

import { useEffect, useCallback, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Phone } from "lucide-react";
import {
  isQuickActionSheetOpenAtom,
  toggleQuickActionSheetAtom,
  closeQuickActionSheetAtom,
  focusedActionIndexAtom,
  focusNextActionAtom,
  focusPreviousActionAtom,
} from "./atoms";
import { trackQuickActionEvent } from "./analytics";
import type { QuickAction, QuickActionId } from "./types";
import { hasPermission, type Resource, type Action } from "@/lib/rbac/permissions";
import type { UserRole } from "@/types";

// ============================================
// ACTION DEFINITIONS
// ============================================

const ALL_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "create-conversation",
    label: "New Conversation",
    description: "Start an in-person or video conversation",
    icon: MessageSquarePlus,
    href: "/conversations/new",
    // Conversations are available to all authenticated users (no RBAC check)
    permission: undefined,
  },
  {
    id: "call-client",
    label: "Call a Client",
    description: "Make a phone call to a client",
    icon: Phone,
    href: "/clients",
    permission: ["calls", "create"],
  },
];

// ============================================
// HOOKS
// ============================================

/**
 * Get available quick actions filtered by user permissions.
 * Uses direct permission checking (not context-based).
 */
export function useQuickActions(userRole: UserRole): QuickAction[] {
  return useMemo(() => {
    return ALL_QUICK_ACTIONS.filter((action) => {
      // No permission required = available to all
      if (!action.permission) return true;

      // Check RBAC permission
      const [resource, actionType] = action.permission;
      return hasPermission(userRole, resource as Resource, actionType as Action);
    });
  }, [userRole]);
}

/**
 * Keyboard shortcut handler for opening quick actions.
 * Listens for Cmd/Ctrl+K.
 */
export function useQuickActionKeyboard(): void {
  const [isOpen] = useAtom(isQuickActionSheetOpenAtom);
  const toggle = useSetAtom(toggleQuickActionSheetAtom);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        toggle();

        if (!isOpen) {
          trackQuickActionEvent("SHEET_OPENED_KEYBOARD");
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle, isOpen]);
}

/**
 * Keyboard navigation within the quick action sheet.
 */
export function useQuickActionNavigation(actions: QuickAction[]): {
  focusedIndex: number;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  selectAction: (action: QuickAction, source: "click" | "keyboard") => void;
} {
  const router = useRouter();
  const [focusedIndex] = useAtom(focusedActionIndexAtom);
  const focusNext = useSetAtom(focusNextActionAtom);
  const focusPrevious = useSetAtom(focusPreviousActionAtom);
  const closeSheet = useSetAtom(closeQuickActionSheetAtom);

  const selectAction = useCallback(
    (action: QuickAction, source: "click" | "keyboard") => {
      trackQuickActionEvent("ACTION_SELECTED", {
        action: action.id as QuickActionId,
        source,
      });
      closeSheet();
      router.push(action.href);
    },
    [closeSheet, router]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          focusNext(actions.length);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          focusPrevious(actions.length);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (actions[focusedIndex]) {
            selectAction(actions[focusedIndex], "keyboard");
          }
          break;
        case "Escape":
          event.preventDefault();
          closeSheet();
          trackQuickActionEvent("SHEET_CLOSED");
          break;
      }
    },
    [actions, focusedIndex, focusNext, focusPrevious, closeSheet, selectAction]
  );

  return { focusedIndex, handleKeyDown, selectAction };
}
