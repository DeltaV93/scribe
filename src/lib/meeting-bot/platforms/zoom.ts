/**
 * Zoom Platform Handler (PX-865)
 * Parses Zoom meeting URLs and handles Zoom-specific logic
 */

import type { ParsedMeetingInfo } from "../types";

// Zoom URL patterns
const ZOOM_URL_PATTERNS = [
  // Standard zoom.us links
  /^https?:\/\/(?:[\w-]+\.)?zoom\.us\/j\/(\d+)(?:\?pwd=([a-zA-Z0-9]+))?/,
  // Short zoom.us links
  /^https?:\/\/(?:[\w-]+\.)?zoom\.us\/my\/([a-zA-Z0-9._-]+)/,
  // Vanity URL with meeting ID
  /^https?:\/\/([a-zA-Z0-9-]+)\.zoom\.us\/j\/(\d+)(?:\?pwd=([a-zA-Z0-9]+))?/,
  // zoomgov.com (government)
  /^https?:\/\/(?:[\w-]+\.)?zoomgov\.com\/j\/(\d+)(?:\?pwd=([a-zA-Z0-9]+))?/,
];

/**
 * Check if a URL is a Zoom meeting link
 */
export function isZoomUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase();
  return (
    normalizedUrl.includes("zoom.us") ||
    normalizedUrl.includes("zoomgov.com")
  );
}

/**
 * Parse a Zoom meeting URL
 */
export function parseZoomUrl(url: string): ParsedMeetingInfo {
  const trimmedUrl = url.trim();

  // Try each pattern
  for (const pattern of ZOOM_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match) {
      // Standard meeting ID pattern
      if (match[1] && /^\d+$/.test(match[1])) {
        return {
          platform: "ZOOM",
          meetingId: match[1],
          password: match[2],
          isValid: true,
        };
      }
      // Vanity URL pattern (subdomain.zoom.us/j/ID)
      if (match[2] && /^\d+$/.test(match[2])) {
        return {
          platform: "ZOOM",
          meetingId: match[2],
          password: match[3],
          isValid: true,
        };
      }
      // Personal meeting room (zoom.us/my/username)
      if (match[1] && !/^\d+$/.test(match[1])) {
        return {
          platform: "ZOOM",
          meetingId: match[1], // This is the personal room ID
          isValid: true,
        };
      }
    }
  }

  return {
    platform: "ZOOM",
    meetingId: "",
    isValid: false,
    error: "Invalid Zoom meeting URL format",
  };
}

/**
 * Validate Zoom meeting ID format
 */
export function isValidZoomMeetingId(meetingId: string): boolean {
  // Zoom meeting IDs are 9-11 digits
  return /^\d{9,11}$/.test(meetingId);
}

/**
 * Format Zoom meeting ID with dashes for display
 */
export function formatZoomMeetingId(meetingId: string): string {
  const digits = meetingId.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return meetingId;
}

/**
 * Build Zoom join URL from meeting ID and optional password
 */
export function buildZoomJoinUrl(meetingId: string, password?: string): string {
  const baseUrl = `https://zoom.us/j/${meetingId}`;
  if (password) {
    return `${baseUrl}?pwd=${password}`;
  }
  return baseUrl;
}

/**
 * Zoom-specific bot display name requirements
 * - Max 64 characters
 * - No special characters except spaces, hyphens, underscores
 */
export function sanitizeZoomDisplayName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .trim()
    .slice(0, 64);
}

/**
 * Zoom waiting room message templates
 */
export const ZOOM_MESSAGES = {
  WAITING_ROOM:
    "Inkra Notetaker is waiting to join. Please admit to start recording.",
  RECORDING_NOTICE:
    "This meeting is being recorded by Inkra for note-taking purposes.",
  LEAVE_MESSAGE: "Thank you for allowing Inkra to capture this meeting.",
};
