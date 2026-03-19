"use client";

/**
 * Quick Action Provider
 *
 * Wrapper component that provides the FAB and Sheet functionality.
 * Add this to the dashboard layout to enable quick actions.
 */

import { QuickActionFAB } from "./quick-action-fab";
import { QuickActionSheet } from "./quick-action-sheet";
import type { UserRole } from "@/types";

interface QuickActionProviderProps {
  /** User role for permission filtering */
  userRole: UserRole;
  /** Whether the FAB is visible (from user preferences) */
  showFab?: boolean;
}

export function QuickActionProvider({ userRole, showFab = true }: QuickActionProviderProps) {
  return (
    <>
      <QuickActionFAB userRole={userRole} visible={showFab} />
      <QuickActionSheet userRole={userRole} />
    </>
  );
}
