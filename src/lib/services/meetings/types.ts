/**
 * Meeting Intelligence Types
 *
 * TypeScript interfaces for the meeting intelligence system.
 */

import { MeetingStatus, MeetingSource, ActionItemStatus } from "@prisma/client";

// ============================================
// MEETING TYPES
// ============================================

export interface MeetingParticipant {
  email?: string;
  name: string;
  role?: string;         // e.g., "host", "presenter", "attendee"
  speakerId?: string;    // For transcript speaker diarization
}

export interface CreateMeetingParams {
  orgId: string;
  createdById: string;
  title: string;
  description?: string;
  source?: MeetingSource;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  participants?: MeetingParticipant[];
  locationId?: string;
  tags?: string[];
  externalMeetingId?: string;
  externalJoinUrl?: string;
}

export interface UpdateMeetingParams {
  title?: string;
  description?: string;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  participants?: MeetingParticipant[];
  locationId?: string;
  tags?: string[];
}

// ============================================
// TRANSCRIPT TYPES
// ============================================

export interface TranscriptSegment {
  speakerId: string;
  speakerName?: string;
  startTime: number;      // Seconds from start
  endTime: number;
  text: string;
  confidence?: number;
}

export interface TranscriptResult {
  fullText: string;
  segments: TranscriptSegment[];
  wordCount: number;
  language: string;
  transcriptionModel: string;
  processingTimeMs: number;
}

export interface TranscriptionOptions {
  language?: string;
  speakerDiarization?: boolean;
  maxSpeakers?: number;
  model?: "deepgram-nova-2" | "whisper-large-v3";
}

// ============================================
// SUMMARY TYPES
// ============================================

export interface KeyPoint {
  point: string;
  context?: string;
  speakerName?: string;
  timestampSeconds?: number;
}

export interface Decision {
  decision: string;
  context?: string;
  participants?: string[];
  timestampSeconds?: number;
}

export interface ExtractedActionItem {
  description: string;
  assigneeName?: string;
  dueDate?: string;
  contextSnippet?: string;
  timestampSeconds?: number;
}

export interface ExtractedQuestion {
  question: string;
  askedByName?: string;
  isAnswered: boolean;
  answer?: string;
  answeredByName?: string;
  contextSnippet?: string;
  timestampSeconds?: number;
}

export interface MeetingSummaryResult {
  executiveSummary: string;
  keyPoints: KeyPoint[];
  decisions: Decision[];
  actionItems: ExtractedActionItem[];
  questions: ExtractedQuestion[];
  topicsDiscussed: string[];
  summaryModel: string;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================
// EMAIL DISTRIBUTION TYPES
// ============================================

export interface SummaryEmailData {
  meetingTitle: string;
  meetingDate: string;
  duration: string;
  participantCount: number;
  executiveSummary: string;
  keyPoints: KeyPoint[];
  decisions: Decision[];
  actionItems: ExtractedActionItem[];
  questions: ExtractedQuestion[];
  meetingUrl: string;      // Link to full meeting detail page
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendSummaryEmailParams {
  meetingId: string;
  recipients: EmailRecipient[];
  customMessage?: string;
}

// ============================================
// JOB DATA
// ============================================

export interface MeetingProcessingJobData {
  jobProgressId: string;
  meetingId: string;
  orgId: string;
  userId: string;
  recordingPath: string;
  options?: {
    skipTranscription?: boolean;
    skipSummarization?: boolean;
    skipEmailDistribution?: boolean;
  };
}

// ============================================
// SEARCH & FILTER
// ============================================

export interface MeetingSearchParams {
  orgId: string;
  query?: string;
  status?: MeetingStatus;
  source?: MeetingSource;
  locationId?: string;
  fromDate?: Date;
  toDate?: Date;
  participantEmail?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ActionItemSearchParams {
  orgId: string;
  meetingId?: string;
  assigneeUserId?: string;
  status?: ActionItemStatus;
  dueBefore?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// PROCESSING PIPELINE
// ============================================

export interface ProcessingStage {
  stage: "upload" | "transcription" | "summarization" | "email" | "indexing";
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MeetingProcessingStatus {
  meetingId: string;
  overallStatus: MeetingStatus;
  stages: ProcessingStage[];
  estimatedTimeRemaining?: number; // seconds
}
