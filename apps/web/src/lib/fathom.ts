// Fathom Analytics configuration for Client Portal
// See: https://usefathom.com/docs/integrations/react

export const FATHOM_SITE_ID = process.env.NEXT_PUBLIC_FATHOM_SITE_ID;

// Portal-specific event names
export type PortalEvent =
  | "portal_session_created"
  | "portal_message_sent"
  | "portal_pin_set"
  | "portal_pin_verified"
  | "portal_phone_changed"
  | "portal_sms_optin"
  | "portal_sms_optout"
  | "portal_page_view";

// Event value mapping (for goal tracking)
const eventValues: Partial<Record<PortalEvent, number>> = {
  portal_session_created: 100,
  portal_message_sent: 50,
  portal_pin_set: 25,
  portal_phone_changed: 25,
};

/**
 * Track a portal-specific event in Fathom
 * Call this client-side only
 */
export function trackPortalEvent(event: PortalEvent): void {
  // Ensure we're in browser and Fathom is loaded
  if (typeof window === "undefined") return;

  const fathom = (window as any).fathom;
  if (!fathom) {
    // Fathom not loaded yet, log for debugging
    if (process.env.NODE_ENV === "development") {
      console.log("[Fathom] Would track event:", event);
    }
    return;
  }

  // Track as a goal with optional value
  const value = eventValues[event];
  if (value) {
    fathom.trackGoal(event, value);
  } else {
    fathom.trackGoal(event, 0);
  }
}

/**
 * Track a page view in Fathom
 * Automatically handles SPA navigation
 */
export function trackPageView(): void {
  if (typeof window === "undefined") return;

  const fathom = (window as any).fathom;
  if (!fathom) return;

  fathom.trackPageview();
}

/**
 * Check if Fathom is configured
 */
export function isFathomConfigured(): boolean {
  return !!FATHOM_SITE_ID;
}
