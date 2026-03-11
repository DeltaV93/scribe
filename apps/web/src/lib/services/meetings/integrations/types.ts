/**
 * Meeting Integration Types
 *
 * Type definitions for Teams/Zoom/Google Meet integrations.
 */

import { MeetingPlatform, IntegrationStatus } from "@prisma/client";

// ============================================
// OAUTH TYPES
// ============================================

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
}

export interface OAuthState {
  orgId: string;
  userId: string;
  platform: MeetingPlatform;
  redirectUrl?: string;
  timestamp: number;
}

// ============================================
// INTEGRATION TYPES
// ============================================

export interface IntegrationConfig {
  platform: MeetingPlatform;
  oauth: OAuthConfig;
  webhookUrl: string;
}

export interface IntegrationCredentials {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  externalUserId?: string;
  externalTenantId?: string;
}

export interface IntegrationSettings {
  autoRecordEnabled?: boolean;
  syncCalendarEnabled?: boolean;
  // Platform-specific settings
  [key: string]: unknown;
}

export interface Integration {
  id: string;
  orgId: string;
  platform: MeetingPlatform;
  status: IntegrationStatus;
  settings: IntegrationSettings;
  autoRecordEnabled: boolean;
  syncCalendarEnabled: boolean;
  lastSyncAt?: Date | null;
  lastError?: string | null;
  connectedAt: Date;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookSubscription {
  id: string;
  platform: MeetingPlatform;
  expiresAt?: Date;
  resource?: string;
}

export interface RecordingEvent {
  platform: MeetingPlatform;
  eventType: "recording.completed" | "recording.available" | "recording.ready";
  meetingId: string;
  meetingTitle?: string;
  recordingUrl?: string;
  recordingId?: string;
  duration?: number;
  startTime?: Date;
  endTime?: Date;
  participants?: Array<{
    email?: string;
    name?: string;
  }>;
  metadata?: Record<string, unknown>;
}

// ============================================
// PLATFORM-SPECIFIC TYPES
// ============================================

// Microsoft Teams
export interface TeamsWebhookPayload {
  value: Array<{
    subscriptionId: string;
    changeType: string;
    resource: string;
    resourceData: {
      "@odata.type": string;
      id: string;
      [key: string]: unknown;
    };
    tenantId: string;
  }>;
  validationToken?: string;
}

export interface TeamsRecording {
  id: string;
  meetingId: string;
  recordingContentUrl: string;
  createdDateTime: string;
  recordingStatus: string;
}

// Zoom
export interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
      uuid?: string;
      id?: string;
      host_id?: string;
      topic?: string;
      start_time?: string;
      duration?: number;
      recording_files?: Array<{
        id: string;
        meeting_id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_size: number;
        download_url: string;
        status: string;
      }>;
      [key: string]: unknown;
    };
  };
}

export interface ZoomRecording {
  uuid: string;
  meetingId: string;
  topic: string;
  startTime: string;
  duration: number;
  downloadUrl: string;
  fileType: string;
  fileSize: number;
}

// Google Meet
export interface GoogleMeetWebhookPayload {
  kind: string;
  id: string;
  resourceId: string;
  resourceUri: string;
  channelId: string;
  token?: string;
  expiration?: string;
}

export interface GoogleMeetRecording {
  name: string;
  meetingCode: string;
  startTime: string;
  endTime: string;
  driveFileId: string;
  mimeType: string;
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface MeetingPlatformService {
  platform: MeetingPlatform;

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;

  /**
   * Refresh expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Register webhook for recording events
   */
  registerWebhook(
    accessToken: string,
    webhookUrl: string
  ): Promise<WebhookSubscription>;

  /**
   * Unregister webhook subscription
   */
  unregisterWebhook(
    accessToken: string,
    subscriptionId: string
  ): Promise<void>;

  /**
   * Download recording from platform
   */
  downloadRecording(
    accessToken: string,
    recordingUrl: string
  ): Promise<Buffer>;

  /**
   * Validate incoming webhook request
   */
  validateWebhook(
    payload: unknown,
    signature?: string,
    secret?: string
  ): boolean;

  /**
   * Parse webhook payload into standardized event
   */
  parseWebhookPayload(payload: unknown): RecordingEvent | null;
}
