/**
 * Microsoft Teams Platform Handler (PX-865)
 * Parses Teams meeting URLs and handles Teams-specific logic
 */

import type { ParsedMeetingInfo } from "../types";

// Microsoft Teams URL patterns
const TEAMS_URL_PATTERNS = [
  // Standard Teams meeting links
  /^https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/([^/?]+)/i,
  // Teams live events
  /^https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^?]+\?context=([^&]+)/i,
  // Short teams.ms links
  /^https?:\/\/teams\.ms\/l\/meetup-join\/([^/?]+)/i,
  // Teams meeting with tenant
  /^https?:\/\/teams\.microsoft\.com\/meet\/([^/?]+)/i,
];

// Pattern to extract meeting context from encoded URL
const CONTEXT_PATTERN = /"Tid":"([^"]+)","Oid":"([^"]+)"/;

/**
 * Check if a URL is a Microsoft Teams meeting link
 */
export function isTeamsUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase();
  return (
    normalizedUrl.includes("teams.microsoft.com") ||
    normalizedUrl.includes("teams.ms")
  );
}

/**
 * Parse a Microsoft Teams meeting URL
 */
export function parseTeamsUrl(url: string): ParsedMeetingInfo {
  const trimmedUrl = url.trim();

  // Try each pattern
  for (const pattern of TEAMS_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      // Decode the meeting ID (URL encoded)
      let meetingId: string;
      try {
        meetingId = decodeURIComponent(match[1]);
      } catch {
        meetingId = match[1];
      }

      // Extract tenant and organizer IDs if present
      const contextMatch = trimmedUrl.match(/context=([^&]+)/);
      let tenantId: string | undefined;
      let organizerId: string | undefined;

      if (contextMatch) {
        try {
          const decoded = decodeURIComponent(contextMatch[1]);
          const contextData = CONTEXT_PATTERN.exec(decoded);
          if (contextData) {
            tenantId = contextData[1];
            organizerId = contextData[2];
          }
        } catch {
          // Context parsing failed, continue without it
        }
      }

      return {
        platform: "MICROSOFT_TEAMS",
        meetingId: meetingId,
        isValid: true,
      };
    }
  }

  return {
    platform: "MICROSOFT_TEAMS",
    meetingId: "",
    isValid: false,
    error: "Invalid Microsoft Teams meeting URL format",
  };
}

/**
 * Validate Teams meeting URL structure
 */
export function isValidTeamsMeetingUrl(url: string): boolean {
  return TEAMS_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extract thread ID from Teams meeting URL
 */
export function extractTeamsThreadId(url: string): string | null {
  const threadPattern = /19:meeting_([a-zA-Z0-9_-]+)@thread\.v2/;
  const match = url.match(threadPattern);
  return match ? match[1] : null;
}

/**
 * Microsoft Teams-specific bot display name requirements
 * - Max 256 characters
 * - Will appear as guest participant
 */
export function sanitizeTeamsDisplayName(name: string): string {
  return name.trim().slice(0, 256);
}

/**
 * Teams lobby handling
 * Teams has a lobby (waiting room) feature that may need host approval
 */
export interface TeamsLobbyInfo {
  isInLobby: boolean;
  lobbyBypassEnabled: boolean;
  estimatedWaitTime?: number;
}

/**
 * Teams specific considerations
 * - May have lobby/waiting room
 * - Guest access policies vary by tenant
 * - Recording permissions controlled by admin policies
 */
export const TEAMS_NOTES = {
  LOBBY: "Teams may place bots in lobby pending host approval",
  GUEST_ACCESS: "Guest access must be enabled in tenant settings",
  RECORDING_POLICY: "Recording may be restricted by organization policy",
  LIVE_CAPTIONS: "Teams provides live captions that may be captured",
};

/**
 * Microsoft Teams message templates
 */
export const TEAMS_MESSAGES = {
  LOBBY_WAITING:
    "Inkra Notetaker is waiting in the lobby. Please admit to start recording.",
  RECORDING_NOTICE:
    "This meeting is being recorded by Inkra for note-taking purposes.",
  LEAVE_MESSAGE: "Thank you for allowing Inkra to capture this meeting.",
};

/**
 * Build Teams deep link for meeting
 */
export function buildTeamsDeepLink(meetingUrl: string): string {
  // Teams app deep link format
  const encoded = encodeURIComponent(meetingUrl);
  return `msteams://teams.microsoft.com/l/meetup-join/${encoded}`;
}
