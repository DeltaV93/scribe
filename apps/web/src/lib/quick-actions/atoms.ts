/**
 * Quick Action Atoms
 *
 * Jotai atoms for managing quick action FAB state.
 */

import { atom } from "jotai";

// ============================================
// SHEET STATE
// ============================================

/** Whether the quick action sheet is open */
export const isQuickActionSheetOpenAtom = atom(false);

/** Index of the currently focused action (for keyboard navigation) */
export const focusedActionIndexAtom = atom(0);

// ============================================
// ACTION ATOMS
// ============================================

/** Open the quick action sheet */
export const openQuickActionSheetAtom = atom(null, (_get, set) => {
  set(isQuickActionSheetOpenAtom, true);
  set(focusedActionIndexAtom, 0);
});

/** Close the quick action sheet */
export const closeQuickActionSheetAtom = atom(null, (_get, set) => {
  set(isQuickActionSheetOpenAtom, false);
});

/** Toggle the quick action sheet */
export const toggleQuickActionSheetAtom = atom(null, (get, set) => {
  const isOpen = get(isQuickActionSheetOpenAtom);
  if (isOpen) {
    set(isQuickActionSheetOpenAtom, false);
  } else {
    set(isQuickActionSheetOpenAtom, true);
    set(focusedActionIndexAtom, 0);
  }
});

/** Move focus to next action */
export const focusNextActionAtom = atom(
  null,
  (get, set, totalActions: number) => {
    const current = get(focusedActionIndexAtom);
    set(focusedActionIndexAtom, (current + 1) % totalActions);
  }
);

/** Move focus to previous action */
export const focusPreviousActionAtom = atom(
  null,
  (get, set, totalActions: number) => {
    const current = get(focusedActionIndexAtom);
    set(focusedActionIndexAtom, (current - 1 + totalActions) % totalActions);
  }
);
