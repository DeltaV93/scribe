/**
 * Meeting Bot Types (PX-865)
 * Type definitions for video meeting bot system
 */

import type { VideoPlatform } from "@prisma/client";

/**
 * Bot status enum
 */
export type BotStatus =
  | "idle"
  | "joining"
  | "waiting_room"
  | "in_meeting"
  | "recording"
  | "leaving"
  | "completed"
  | "failed"
  | "kicked";

/**
 * Configuration for joining a meeting
 */
export interface MeetingBotConfig {
  platform: VideoPlatform;
  meetingUrl: string;
  conversationId: string;
  displayName: string;
  orgId: string;
  userId: string;
  // Optional meeting credentials
  meetingPassword?: string;
  // Recording preferences
  recordAudio: boolean;
  recordVideo: boolean;
  // Timing
  joinBeforeHost?: boolean;
  maxWaitMinutes?: number;
  maxDurationMinutes?: number;
}

/**
 * Bot instance state
 */
export interface BotInstance {
  id: string;
  conversationId: string;
  platform: VideoPlatform;
  meetingUrl: string;
  status: BotStatus;
  displayName: string;
  orgId: string;
  userId: string;
  // Timing
  createdAt: Date;
  joinedAt?: Date;
  leftAt?: Date;
  // Recording
  recordingStartedAt?: Date;
  recordingUrl?: string;
  // Error tracking
  error?: string;
  errorCode?: string;
  retryCount: number;
  // Participants detected
  participantCount?: number;
  participants?: string[];
}

/**
 * Response from bot service
 */
export interface BotServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Join meeting request to bot service
 */
export interface JoinMeetingRequest {
  botId: string;
  config: MeetingBotConfig;
  callbackUrl: string; // Webhook URL for status updates
}

/**
 * Leave meeting request to bot service
 */
export interface LeaveMeetingRequest {
  botId: string;
  reason?: "user_requested" | "meeting_ended" | "timeout" | "error";
}

/**
 * Bot status update webhook payload
 */
export interface BotStatusWebhook {
  botId: string;
  conversationId: string;
  status: BotStatus;
  timestamp: string;
  // Additional context based on status
  details?: {
    participantCount?: number;
    participants?: string[];
    recordingUrl?: string;
    error?: string;
    errorCode?: string;
    duration?: number; // seconds
  };
}

/**
 * Recording completed webhook payload
 */
export interface RecordingCompletedWebhook {
  botId: string;
  conversationId: string;
  recordingUrl: string;
  duration: number; // seconds
  fileSize: number; // bytes
  mimeType: string;
  timestamp: string;
}

/**
 * Platform-specific meeting info extracted from URL
 */
export interface ParsedMeetingInfo {
  platform: VideoPlatform;
  meetingId: string;
  password?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Bot service health status
 */
export interface BotServiceHealth {
  healthy: boolean;
  availableBots: number;
  activeBots: number;
  queuedRequests: number;
  lastHeartbeat: string;
  version: string;
}

/**
 * Meeting bot error codes
 */
export const BOT_ERROR_CODES = {
  // Connection errors
  MEETING_NOT_FOUND: "MEETING_NOT_FOUND",
  INVALID_URL: "INVALID_URL",
  JOIN_FAILED: "JOIN_FAILED",
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  // Access errors
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  WAITING_ROOM_TIMEOUT: "WAITING_ROOM_TIMEOUT",
  HOST_NOT_STARTED: "HOST_NOT_STARTED",
  KICKED_BY_HOST: "KICKED_BY_HOST",
  MEETING_FULL: "MEETING_FULL",
  // Recording errors
  RECORDING_FAILED: "RECORDING_FAILED",
  RECORDING_PERMISSION_DENIED: "RECORDING_PERMISSION_DENIED",
  STORAGE_ERROR: "STORAGE_ERROR",
  // Service errors
  BOT_SERVICE_UNAVAILABLE: "BOT_SERVICE_UNAVAILABLE",
  BOT_LIMIT_REACHED: "BOT_LIMIT_REACHED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type BotErrorCode = (typeof BOT_ERROR_CODES)[keyof typeof BOT_ERROR_CODES];
