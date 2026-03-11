/**
 * Google Meet Integration Service
 *
 * Handles OAuth authentication, webhook registration (via Google Calendar
 * push notifications), and recording downloads for Google Meet meetings.
 */

import { MeetingPlatform } from "@prisma/client";
import {
  MeetingPlatformService,
  OAuthTokens,
  WebhookSubscription,
  RecordingEvent,
  GoogleMeetWebhookPayload,
} from "./types";

// ============================================
// CONFIGURATION
// ============================================

const GOOGLE_CONFIG = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  calendarApiBaseUrl: "https://www.googleapis.com/calendar/v3",
  driveApiBaseUrl: "https://www.googleapis.com/drive/v3",
  scopes: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
};

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class GoogleMeetIntegrationService implements MeetingPlatformService {
  readonly platform = MeetingPlatform.GOOGLE_MEET;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || "";
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    this.redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meetings/callback/google`;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        "[Google Meet] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables"
      );
    }
  }

  /**
   * Generate OAuth authorization URL for Google
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: GOOGLE_CONFIG.scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return `${GOOGLE_CONFIG.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access/refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    });

    const response = await fetch(GOOGLE_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google token exchange failed: ${error.error_description || error.error}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(GOOGLE_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google token refresh failed: ${error.error_description || error.error}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Google doesn't always return new refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * Register webhook for Google Calendar push notifications
   * Google Meet recordings are associated with calendar events
   */
  async registerWebhook(
    accessToken: string,
    webhookUrl: string
  ): Promise<WebhookSubscription> {
    // Generate unique channel ID
    const channelId = `scrybe-meet-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Set expiration to 7 days (maximum for Google push notifications)
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const response = await fetch(
      `${GOOGLE_CONFIG.calendarApiBaseUrl}/calendars/primary/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          expiration: expiration,
          params: {
            ttl: "604800", // 7 days in seconds
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google webhook registration failed: ${error.error?.message || "Unknown error"}`
      );
    }

    const data = await response.json();

    return {
      id: data.id,
      platform: MeetingPlatform.GOOGLE_MEET,
      expiresAt: new Date(parseInt(data.expiration)),
      resource: data.resourceId,
    };
  }

  /**
   * Unregister webhook subscription
   */
  async unregisterWebhook(
    accessToken: string,
    subscriptionId: string
  ): Promise<void> {
    const response = await fetch(
      `${GOOGLE_CONFIG.calendarApiBaseUrl}/channels/stop`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: subscriptionId,
          resourceId: subscriptionId, // In practice, store and use the actual resourceId
        }),
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(
        `Google webhook unregistration failed: ${error.error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Download recording from Google Drive
   */
  async downloadRecording(
    accessToken: string,
    recordingUrl: string
  ): Promise<Buffer> {
    // Extract file ID from Drive URL or use directly
    let fileId = recordingUrl;
    if (recordingUrl.includes("drive.google.com")) {
      const match = recordingUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
      }
    }

    const response = await fetch(
      `${GOOGLE_CONFIG.driveApiBaseUrl}/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Google Drive download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Validate incoming webhook request
   * Google uses a channel token for validation
   */
  validateWebhook(
    payload: unknown,
    signature?: string,
    secret?: string
  ): boolean {
    // Google sends notifications with X-Goog-Channel-Token header
    // If we set a token during registration, validate it here
    if (secret && signature !== secret) {
      return false;
    }

    // Basic structure validation
    if (!payload || typeof payload !== "object") {
      return false;
    }

    return true;
  }

  /**
   * Parse Google webhook payload into standardized event
   */
  parseWebhookPayload(payload: unknown): RecordingEvent | null {
    const googlePayload = payload as GoogleMeetWebhookPayload;

    // Google push notifications are "pings" that tell you to fetch changes
    // They don't contain the actual data
    if (!googlePayload.resourceId) {
      return null;
    }

    // Return an event indicating we need to sync
    return {
      platform: MeetingPlatform.GOOGLE_MEET,
      eventType: "recording.available",
      meetingId: googlePayload.resourceId,
      metadata: {
        channelId: googlePayload.channelId,
        resourceUri: googlePayload.resourceUri,
        expiration: googlePayload.expiration,
      },
    };
  }

  /**
   * Get user profile from Google
   */
  async getUserProfile(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Google user profile: ${response.status}`);
    }

    return response.json();
  }

  /**
   * List calendar events with Meet links
   */
  async getCalendarEventsWithMeet(
    accessToken: string,
    options?: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
    }
  ): Promise<Array<{
    id: string;
    summary: string;
    start: { dateTime: string };
    end: { dateTime: string };
    hangoutLink?: string;
    conferenceData?: {
      conferenceId: string;
      conferenceSolution: { name: string };
    };
    attachments?: Array<{
      fileId: string;
      fileUrl: string;
      mimeType: string;
      title: string;
    }>;
  }>> {
    const params = new URLSearchParams({
      calendarId: "primary",
      maxResults: String(options?.maxResults || 50),
      orderBy: "startTime",
      singleEvents: "true",
    });

    if (options?.timeMin) {
      params.set("timeMin", options.timeMin.toISOString());
    }
    if (options?.timeMax) {
      params.set("timeMax", options.timeMax.toISOString());
    }

    const response = await fetch(
      `${GOOGLE_CONFIG.calendarApiBaseUrl}/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Google Calendar events: ${response.status}`);
    }

    const data = await response.json();

    // Filter to only events with Google Meet links
    return (data.items || []).filter(
      (event: { hangoutLink?: string; conferenceData?: unknown }) =>
        event.hangoutLink || event.conferenceData
    );
  }

  /**
   * Get recording attachment from a calendar event
   * Google Meet recordings are stored in Drive and linked to calendar events
   */
  async getEventRecordings(
    accessToken: string,
    eventId: string
  ): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    webContentLink?: string;
  }>> {
    // First get the event to find attachments
    const response = await fetch(
      `${GOOGLE_CONFIG.calendarApiBaseUrl}/calendars/primary/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get calendar event: ${response.status}`);
    }

    const event = await response.json();

    // Get attachments that are video recordings
    const recordings: Array<{
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
      webContentLink?: string;
    }> = [];

    if (event.attachments) {
      for (const attachment of event.attachments) {
        if (
          attachment.mimeType?.startsWith("video/") ||
          attachment.mimeType === "application/octet-stream"
        ) {
          // Fetch full file metadata from Drive
          const fileResponse = await fetch(
            `${GOOGLE_CONFIG.driveApiBaseUrl}/files/${attachment.fileId}?fields=id,name,mimeType,webViewLink,webContentLink`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (fileResponse.ok) {
            recordings.push(await fileResponse.json());
          }
        }
      }
    }

    return recordings;
  }
}

// Export singleton instance
export const googleMeetService = new GoogleMeetIntegrationService();
