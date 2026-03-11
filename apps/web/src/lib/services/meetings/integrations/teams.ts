/**
 * Microsoft Teams Integration Service
 *
 * Handles OAuth authentication, webhook registration, and recording
 * downloads for Microsoft Teams meetings via the Graph API.
 */

import { MeetingPlatform } from "@prisma/client";
import {
  MeetingPlatformService,
  OAuthTokens,
  WebhookSubscription,
  RecordingEvent,
  TeamsWebhookPayload,
} from "./types";

// ============================================
// CONFIGURATION
// ============================================

const TEAMS_CONFIG = {
  authorizationEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint:
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  graphApiBaseUrl: "https://graph.microsoft.com/v1.0",
  scopes: [
    "offline_access",
    "User.Read",
    "OnlineMeetings.Read",
    "OnlineMeetingRecording.Read.All",
  ],
};

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class TeamsIntegrationService implements MeetingPlatformService {
  readonly platform = MeetingPlatform.TEAMS;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.TEAMS_CLIENT_ID || "";
    this.clientSecret = process.env.TEAMS_CLIENT_SECRET || "";
    this.redirectUri =
      process.env.TEAMS_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meetings/callback/teams`;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        "[Teams] Missing TEAMS_CLIENT_ID or TEAMS_CLIENT_SECRET environment variables"
      );
    }
  }

  /**
   * Generate OAuth authorization URL for Teams
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      response_mode: "query",
      scope: TEAMS_CONFIG.scopes.join(" "),
      state,
      prompt: "consent",
    });

    return `${TEAMS_CONFIG.authorizationEndpoint}?${params.toString()}`;
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
      scope: TEAMS_CONFIG.scopes.join(" "),
    });

    const response = await fetch(TEAMS_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Teams token exchange failed: ${error.error_description || error.error}`
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
      scope: TEAMS_CONFIG.scopes.join(" "),
    });

    const response = await fetch(TEAMS_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Teams token refresh failed: ${error.error_description || error.error}`
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
   * Register webhook subscription for recording events
   * Uses Microsoft Graph change notifications
   */
  async registerWebhook(
    accessToken: string,
    webhookUrl: string
  ): Promise<WebhookSubscription> {
    // Teams uses Graph API subscriptions for change notifications
    // Note: Webhook registration requires admin consent in the Azure portal
    const expirationDateTime = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000 // 3 days (max for Teams resources)
    );

    const response = await fetch(
      `${TEAMS_CONFIG.graphApiBaseUrl}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeType: "created,updated",
          notificationUrl: webhookUrl,
          resource: "communications/onlineMeetings",
          expirationDateTime: expirationDateTime.toISOString(),
          clientState: this.generateClientState(),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Teams webhook registration failed: ${error.error?.message || "Unknown error"}`
      );
    }

    const subscription = await response.json();

    return {
      id: subscription.id,
      platform: MeetingPlatform.TEAMS,
      expiresAt: new Date(subscription.expirationDateTime),
      resource: subscription.resource,
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
      `${TEAMS_CONFIG.graphApiBaseUrl}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(
        `Teams webhook unregistration failed: ${error.error?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Download recording from Teams/OneDrive
   */
  async downloadRecording(
    accessToken: string,
    recordingUrl: string
  ): Promise<Buffer> {
    const response = await fetch(recordingUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Teams recording download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Validate incoming webhook signature
   * Teams uses a client state for validation
   */
  validateWebhook(
    payload: unknown,
    signature?: string,
    secret?: string
  ): boolean {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    const teamsPayload = payload as TeamsWebhookPayload;

    // Handle validation request (initial webhook subscription)
    if (teamsPayload.validationToken) {
      return true;
    }

    // For regular notifications, validate client state if provided
    if (secret && teamsPayload.value?.[0]) {
      // In production, validate the client state matches
      // For now, basic structure validation
      return Array.isArray(teamsPayload.value);
    }

    return Array.isArray(teamsPayload.value);
  }

  /**
   * Parse Teams webhook payload into standardized event
   */
  parseWebhookPayload(payload: unknown): RecordingEvent | null {
    const teamsPayload = payload as TeamsWebhookPayload;

    // Handle validation token (return null, handled separately)
    if (teamsPayload.validationToken) {
      return null;
    }

    if (!teamsPayload.value?.[0]) {
      return null;
    }

    const notification = teamsPayload.value[0];

    // Check if this is a recording-related notification
    if (!notification.resource.includes("recording")) {
      return null;
    }

    return {
      platform: MeetingPlatform.TEAMS,
      eventType: "recording.completed",
      meetingId: notification.resourceData.id,
      metadata: {
        tenantId: notification.tenantId,
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resourceData: notification.resourceData,
      },
    };
  }

  /**
   * Get user profile from Teams
   */
  async getUserProfile(accessToken: string): Promise<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }> {
    const response = await fetch(`${TEAMS_CONFIG.graphApiBaseUrl}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Teams user profile: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get meeting recordings for a specific meeting
   */
  async getMeetingRecordings(
    accessToken: string,
    meetingId: string
  ): Promise<Array<{ id: string; contentUrl: string; createdDateTime: string }>> {
    const response = await fetch(
      `${TEAMS_CONFIG.graphApiBaseUrl}/communications/onlineMeetings/${meetingId}/recordings`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Teams recordings: ${response.status}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Generate a random client state for webhook validation
   */
  private generateClientState(): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
      "base64"
    );
  }
}

// Export singleton instance
export const teamsService = new TeamsIntegrationService();
