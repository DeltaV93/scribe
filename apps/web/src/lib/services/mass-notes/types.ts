/**
 * Mass Notes Types
 *
 * TypeScript interfaces for the Mass Notes feature.
 */

import { NoteType, JobStatus } from '@prisma/client'

/**
 * Input for creating a mass note batch job
 */
export interface MassNoteInput {
  sessionId: string
  orgId: string
  authorId: string
  templateId?: string
  templateContent: string
  noteType: NoteType
  tags: string[]
  clientIds: string[]
  customVariables?: Record<string, string>
}

/**
 * Input for previewing mass notes
 */
export interface MassNotePreviewInput {
  sessionId: string
  orgId: string
  templateContent: string
  clientIds: string[]
  customVariables?: Record<string, string>
}

/**
 * Preview result for a single client
 */
export interface MassNotePreview {
  clientId: string
  clientName: string
  resolvedContent: string
}

/**
 * Client attendee info for mass note creation
 */
export interface SessionAttendee {
  clientId: string
  clientName: string
  status: string
  attendanceType: string | null
  hoursAttended: number | null
}

/**
 * Session attendees response
 */
export interface SessionAttendeesResult {
  sessionId: string
  sessionTitle: string
  sessionDate: Date | null
  attendees: SessionAttendee[]
  totalAttendees: number
}

/**
 * Mass note batch status
 */
export interface MassNoteBatchStatus {
  id: string
  type: string
  status: JobStatus
  progress: number
  total: number
  completed: number
  failed: number
  result: MassNoteBatchResult | null
  error: string | null
  metadata: MassNoteBatchMetadata | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string | null
    email: string
  }
}

/**
 * Metadata stored with the batch job
 */
export interface MassNoteBatchMetadata {
  sessionId: string
  sessionTitle: string
  templateId?: string
}

/**
 * Result stored when batch completes
 */
export interface MassNoteBatchResult {
  completed: number
  failed: number
  errors?: string[]
}

/**
 * Variable categories for template interpolation
 */
export interface TemplateVariables {
  client: {
    firstName: string
    lastName: string
    fullName: string
  }
  session: {
    title: string
    date: string
    topic: string
    duration: string
  }
  program: {
    name: string
    facilitator: string
  }
  attendance: {
    type: string
    timeIn: string
    timeOut: string
    hoursAttended: string
  }
  custom: Record<string, string>
}

/**
 * Available template variable keys
 */
export const AVAILABLE_VARIABLES = [
  'client.firstName',
  'client.lastName',
  'client.fullName',
  'session.title',
  'session.date',
  'session.topic',
  'session.duration',
  'program.name',
  'program.facilitator',
  'attendance.type',
  'attendance.timeIn',
  'attendance.timeOut',
  'attendance.hoursAttended',
] as const

export type TemplateVariableKey = typeof AVAILABLE_VARIABLES[number]
