/**
 * Meeting Bot Module (PX-865)
 * Video meeting capture via headless browser bots
 */

// Main bot manager
export {
  isMeetingBotEnabled,
  isBotServiceConfigured,
  parseMeetingUrl,
  detectPlatform,
  joinMeeting,
  leaveMeeting,
  getBotStatus,
  handleStatusWebhook,
  handleRecordingCompleted,
  getBotServiceHealth,
  getActiveBots,
  cancelBot,
} from "./bot-manager";

// Types
export type {
  MeetingBotConfig,
  BotInstance,
  BotStatus,
  BotServiceResponse,
  JoinMeetingRequest,
  LeaveMeetingRequest,
  BotStatusWebhook,
  RecordingCompletedWebhook,
  ParsedMeetingInfo,
  BotServiceHealth,
  BotErrorCode,
} from "./types";

export { BOT_ERROR_CODES } from "./types";

// Platform handlers
export {
  isZoomUrl,
  parseZoomUrl,
  isValidZoomMeetingId,
  formatZoomMeetingId,
  buildZoomJoinUrl,
  sanitizeZoomDisplayName,
  ZOOM_MESSAGES,
} from "./platforms/zoom";

export {
  isGoogleMeetUrl,
  parseGoogleMeetUrl,
  isValidMeetCode,
  formatMeetCode,
  buildMeetJoinUrl,
  sanitizeMeetDisplayName,
  GOOGLE_MEET_NOTES,
  MEET_MESSAGES,
} from "./platforms/google-meet";

export {
  isTeamsUrl,
  parseTeamsUrl,
  isValidTeamsMeetingUrl,
  extractTeamsThreadId,
  sanitizeTeamsDisplayName,
  TEAMS_NOTES,
  TEAMS_MESSAGES,
  buildTeamsDeepLink,
} from "./platforms/teams";
