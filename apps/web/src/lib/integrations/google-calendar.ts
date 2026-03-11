/**
 * Google Calendar Integration Client (PX-865)
 * Push calendar events from conversation processing
 */

import { prisma } from "@/lib/db";
import type { CalendarEventDraft } from "@/lib/services/workflow-outputs";

// Google Calendar API base URL
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

interface GoogleCalendarConfig {
  calendarId?: string; // Default to 'primary' if not specified
}

interface CalendarEvent {
  id: string;
  htmlLink: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Get Google Calendar access token for user
 */
async function getAccessToken(orgId: string, userId: string): Promise<string | null> {
  // Check user-level calendar integration with token
  const userIntegration = await prisma.calendarIntegration.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      integrationToken: {
        select: {
          accessToken: true,
          expiresAt: true,
          refreshToken: true,
        },
      },
    },
  });

  if (userIntegration?.integrationToken) {
    const token = userIntegration.integrationToken;

    // Check if token needs refresh
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      if (token.refreshToken) {
        return await refreshAccessToken(userIntegration.id, token.refreshToken);
      }
      return null;
    }
    return token.accessToken;
  }

  // Fallback to org-level integration connection
  const orgConnection = await prisma.integrationConnection.findFirst({
    where: {
      orgId,
      platform: "GOOGLE_CALENDAR",
      isActive: true,
    },
    select: {
      accessToken: true,
    },
  });

  return orgConnection?.accessToken || null;
}

/**
 * Refresh Google OAuth token
 */
async function refreshAccessToken(integrationId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh Google token");
      return null;
    }

    const data = await response.json();

    // Update stored token
    await prisma.integrationToken.updateMany({
      where: { calendarIntegrationId: integrationId },
      data: {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    return null;
  }
}

/**
 * Create a calendar event from draft
 */
export async function createCalendarEvent(
  orgId: string,
  userId: string,
  draft: CalendarEventDraft,
  config?: GoogleCalendarConfig
): Promise<CalendarEvent> {
  const accessToken = await getAccessToken(orgId, userId);
  if (!accessToken) {
    throw new Error("Google Calendar not connected");
  }

  const calendarId = config?.calendarId || "primary";

  // Build event body
  const eventBody: Record<string, unknown> = {
    summary: draft.title,
    description: draft.description + "\n\n---\nCreated from conversation by Inkra",
  };

  // Handle date/time
  if (draft.startTime) {
    const startDate = new Date(draft.startTime);
    const endDate = new Date(startDate.getTime() + (draft.duration || 30) * 60 * 1000);

    eventBody.start = { dateTime: startDate.toISOString() };
    eventBody.end = { dateTime: endDate.toISOString() };
  } else {
    // All-day event for unspecified time
    const today = new Date();
    eventBody.start = { date: today.toISOString().split("T")[0] };
    eventBody.end = { date: today.toISOString().split("T")[0] };
  }

  // Add location if specified
  if (draft.location) {
    eventBody.location = draft.location;
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create calendar event");
  }

  return response.json();
}

/**
 * Get user's calendars (for config UI)
 */
export async function getCalendars(
  orgId: string,
  userId: string
): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const accessToken = await getAccessToken(orgId, userId);
  if (!accessToken) {
    throw new Error("Google Calendar not connected");
  }

  const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch calendars");
  }

  const data = await response.json();

  return data.items.map((cal: { id: string; summary: string; primary?: boolean }) => ({
    id: cal.id,
    summary: cal.summary,
    primary: cal.primary || false,
  }));
}

/**
 * Test Google Calendar connection
 */
export async function testCalendarConnection(accessToken: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: "Invalid token" };
    }

    // Get user info
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (userResponse.ok) {
      const userData = await userResponse.json();
      return { success: true, email: userData.email };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Check for scheduling conflicts
 */
export async function checkConflicts(
  orgId: string,
  userId: string,
  startTime: string,
  endTime: string,
  calendarId?: string
): Promise<Array<{ summary: string; start: string; end: string }>> {
  const accessToken = await getAccessToken(orgId, userId);
  if (!accessToken) {
    throw new Error("Google Calendar not connected");
  }

  const targetCalendar = calendarId || "primary";

  const params = new URLSearchParams({
    timeMin: startTime,
    timeMax: endTime,
    singleEvents: "true",
  });

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(targetCalendar)}/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to check conflicts");
  }

  const data = await response.json();

  return data.items.map((event: CalendarEvent) => ({
    summary: event.summary,
    start: event.start.dateTime || event.start.date || "",
    end: event.end.dateTime || event.end.date || "",
  }));
}
