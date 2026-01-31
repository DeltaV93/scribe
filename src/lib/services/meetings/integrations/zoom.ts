/**
 * Zoom Integration Service
 *
 * Handles OAuth authentication, webhook registration, and recording
 * downloads for Zoom meetings.
 */

import { MeetingPlatform } from "@prisma/client";
import crypto from "crypto";
import {
  MeetingPlatformService,
  OAuthTokens,
  WebhookSubscription,
  RecordingEvent,
  ZoomWebhookPayload,
} from "./types";

// ============================================
// CONFIGURATION
// ============================================

const ZOOM_CONFIG = {
  authorizationEndpoint: "https://zoom.us/oauth/authorize",
  tokenEndpoint: "https://zoom.us/oauth/token",
  apiBaseUrl: "https://api.zoom.us/v2",
  scopes: [
    "meeting:read",
    "recording:read",
    "user:read",
  ],
};

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class ZoomIntegrationService implements MeetingPlatformService {
  readonly platform = MeetingPlatform.ZOOM;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private webhookSecretToken: string;

  constructor() {
    this.clientId = process.env.ZOOM_CLIENT_ID || "";
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET || "";
    this.webhookSecretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
    this.redirectUri =
      process.env.ZOOM_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meetings/callback/zoom`;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        "[Zoom] Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET environment variables"
      );
    }
  }

  /**
   * Generate OAuth authorization URL for Zoom
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      state,
    });

    return `${ZOOM_CONFIG.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access/refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
    });

    const response = await fetch(ZOOM_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Zoom token exchange failed: ${error.reason || error.error}`
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
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(ZOOM_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Zoom token refresh failed: ${error.reason || error.error}`
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * Register webhook for recording events
   * Note: Zoom webhooks are configured in the Zoom App Marketplace dashboard,
   * not via API. This method validates the configuration.
   */
  async registerWebhook(
    accessToken: string,
    webhookUrl: string
  ): Promise<WebhookSubscription> {
    // Zoom webhooks are registered via the Zoom Marketplace app configuration
    // This method is a placeholder that validates the connection

    // Verify we can make authenticated requests
    const userResponse = await fetch(`${ZOOM_CONFIG.apiBaseUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to verify Zoom connection for webhook setup");
    }

    // Return a placeholder subscription since Zoom webhooks
    // are configured externally
    return {
      id: "zoom-app-webhook",
      platform: MeetingPlatform.ZOOM,
      resource: "recording.completed",
    };
  }

  /**
   * Unregister webhook subscription
   * Note: Zoom webhooks are managed via the app dashboard
   */
  async unregisterWebhook(
    _accessToken: string,
    _subscriptionId: string
  ): Promise<void> {
    // Zoom webhooks are managed via the Zoom Marketplace dashboard
    // This is a no-op for Zoom
    console.log(
      "[Zoom] Webhook unregistration is managed via Zoom Marketplace dashboard"
    );
  }

  /**
   * Download recording from Zoom
   */
  async downloadRecording(
    accessToken: string,
    recordingUrl: string
  ): Promise<Buffer> {
    // Zoom recordings require an access token in the query string
    const url = new URL(recordingUrl);
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Zoom recording download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Validate incoming webhook signature
   * Zoom uses HMAC-SHA256 for webhook validation
   */
  validateWebhook(
    payload: unknown,
    signature?: string,
    _secret?: string
  ): boolean {
    if (!signature || !this.webhookSecretToken) {
      return false;
    }

    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    // Zoom sends signature in format "v0=<signature>"
    const [version, receivedSignature] = signature.split("=");
    if (version !== "v0" || !receivedSignature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecretToken)
      .update(payloadString)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse Zoom webhook payload into standardized event
   */
  parseWebhookPayload(payload: unknown): RecordingEvent | null {
    const zoomPayload = payload as ZoomWebhookPayload;

    // Check if this is a recording completion event
    if (
      zoomPayload.event !== "recording.completed" &&
      zoomPayload.event !== "recording.transcript_completed"
    ) {
      return null;
    }

    const meeting = zoomPayload.payload?.object;
    if (!meeting) {
      return null;
    }

    // Get the video recording file
    const videoRecording = meeting.recording_files?.find(
      (f) => f.file_type === "MP4" || f.file_type === "M4A"
    );

    return {
      platform: MeetingPlatform.ZOOM,
      eventType: "recording.completed",
      meetingId: meeting.uuid || meeting.id || "",
      meetingTitle: meeting.topic,
      recordingUrl: videoRecording?.download_url,
      recordingId: videoRecording?.id,
      duration: meeting.duration,
      startTime: meeting.start_time ? new Date(meeting.start_time) : undefined,
      metadata: {
        hostId: meeting.host_id,
        accountId: zoomPayload.payload.account_id,
        recordingFiles: meeting.recording_files,
      },
    };
  }

  /**
   * Get user profile from Zoom
   */
  async getUserProfile(accessToken: string): Promise<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  }> {
    const response = await fetch(`${ZOOM_CONFIG.apiBaseUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Zoom user profile: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get meeting recordings list
   */
  async getMeetingRecordings(
    accessToken: string,
    meetingId: string
  ): Promise<{
    recording_files: Array<{
      id: string;
      download_url: string;
      file_type: string;
      file_size: number;
      recording_start: string;
      recording_end: string;
    }>;
  }> {
    const response = await fetch(
      `${ZOOM_CONFIG.apiBaseUrl}/meetings/${meetingId}/recordings`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Zoom recordings: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Handle Zoom endpoint URL validation (challenge response)
   */
  handleEndpointValidation(payload: {
    payload: { plainToken: string };
  }): { plainToken: string; encryptedToken: string } | null {
    const plainToken = payload?.payload?.plainToken;
    if (!plainToken) {
      return null;
    }

    const encryptedToken = crypto
      .createHmac("sha256", this.webhookSecretToken)
      .update(plainToken)
      .digest("hex");

    return {
      plainToken,
      encryptedToken,
    };
  }
}

// Export singleton instance
export const zoomService = new ZoomIntegrationService();
