/**
 * Google Meet Platform Handler (PX-865)
 * Parses Google Meet URLs and handles Meet-specific logic
 */

import type { ParsedMeetingInfo } from "../types";

// Google Meet URL patterns
const MEET_URL_PATTERNS = [
  // Standard meet.google.com links
  /^https?:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i,
  // Shortened links
  /^https?:\/\/g\.co\/meet\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i,
  // Calendar integration links (with auth params)
  /^https?:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})\?/i,
];

/**
 * Check if a URL is a Google Meet link
 */
export function isGoogleMeetUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase();
  return (
    normalizedUrl.includes("meet.google.com") ||
    normalizedUrl.includes("g.co/meet")
  );
}

/**
 * Parse a Google Meet URL
 */
export function parseGoogleMeetUrl(url: string): ParsedMeetingInfo {
  const trimmedUrl = url.trim();

  // Try each pattern
  for (const pattern of MEET_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      const meetingCode = match[1].toLowerCase();

      // Validate meeting code format (xxx-xxxx-xxx)
      if (isValidMeetCode(meetingCode)) {
        return {
          platform: "GOOGLE_MEET",
          meetingId: meetingCode,
          isValid: true,
        };
      }
    }
  }

  return {
    platform: "GOOGLE_MEET",
    meetingId: "",
    isValid: false,
    error: "Invalid Google Meet URL format",
  };
}

/**
 * Validate Google Meet code format
 * Format: xxx-xxxx-xxx (letters only, case insensitive)
 */
export function isValidMeetCode(code: string): boolean {
  return /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(code);
}

/**
 * Format Google Meet code for display
 */
export function formatMeetCode(code: string): string {
  const normalized = code.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  return code;
}

/**
 * Build Google Meet join URL from meeting code
 */
export function buildMeetJoinUrl(meetingCode: string): string {
  return `https://meet.google.com/${meetingCode}`;
}

/**
 * Google Meet-specific bot display name requirements
 * - Max 60 characters
 * - Will be shown as participant name
 */
export function sanitizeMeetDisplayName(name: string): string {
  return name.trim().slice(0, 60);
}

/**
 * Google Meet specific considerations
 * - No waiting room (participants join directly if allowed)
 * - May require Google account authentication
 * - Recording requires meeting organizer permission in some cases
 */
export const GOOGLE_MEET_NOTES = {
  AUTH_REQUIRED: "Google Meet may require a Google account to join",
  NO_WAITING_ROOM: "Google Meet does not have a traditional waiting room",
  RECORDING_NOTICE: "Participants will see a recording indicator when active",
};

/**
 * Google Meet message templates
 */
export const MEET_MESSAGES = {
  JOINING: "Inkra Notetaker is joining the meeting.",
  RECORDING_NOTICE:
    "This meeting is being recorded by Inkra for note-taking purposes.",
  LEAVE_MESSAGE: "Thank you for allowing Inkra to capture this meeting.",
};
