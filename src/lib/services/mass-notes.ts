/**
 * Mass Notes Service
 *
 * Creates notes for multiple clients in a single operation.
 * Used after group sessions to document attendance and participation.
 */

import { NoteType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { addJob, createJobProgress, MassNoteBatchJobData } from '@/lib/jobs'
import {
  getNoteTemplate,
  resolveTemplateVariables,
  buildVariables,
  VariableContext,
} from './note-templates'
import { isFeatureEnabled } from '@/lib/features/flags'

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

export interface MassNotePreviewInput {
  sessionId: string
  orgId: string
  templateContent: string
  clientIds: string[]
  customVariables?: Record<string, string>
}

export interface MassNotePreview {
  clientId: string
  clientName: string
  resolvedContent: string
}

/**
 * Create a mass note job
 */
export async function createMassNoteJob(input: MassNoteInput): Promise<string> {
  // Verify feature is enabled
  const enabled = await isFeatureEnabled(input.orgId, 'mass-notes')
  if (!enabled) {
    throw new Error('Mass Notes feature is not enabled for this organization')
  }

  // Validate client count
  if (input.clientIds.length === 0) {
    throw new Error('At least one client must be selected')
  }

  if (input.clientIds.length > 500) {
    throw new Error('Cannot create mass notes for more than 500 clients at once')
  }

  // Verify session exists
  const session = await prisma.programSession.findUnique({
    where: { id: input.sessionId },
    include: {
      program: {
        include: {
          organization: true,
          facilitator: true,
        },
      },
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.program.orgId !== input.orgId) {
    throw new Error('Session does not belong to this organization')
  }

  // Verify all clients belong to the org and are in the session
  const validClients = await prisma.client.findMany({
    where: {
      id: { in: input.clientIds },
      orgId: input.orgId,
    },
    select: { id: true },
  })

  const validClientIds = validClients.map((c: { id: string }) => c.id)
  const invalidClientIds = input.clientIds.filter((id) => !validClientIds.includes(id))

  if (invalidClientIds.length > 0) {
    throw new Error(`Invalid client IDs: ${invalidClientIds.slice(0, 5).join(', ')}...`)
  }

  // Create job progress record
  const jobProgress = await createJobProgress({
    type: 'mass-note-batch',
    userId: input.authorId,
    orgId: input.orgId,
    total: validClientIds.length,
    metadata: {
      sessionId: input.sessionId,
      sessionTitle: session.title,
      templateId: input.templateId,
    },
  })

  // Add job to queue
  const jobData: MassNoteBatchJobData = {
    jobProgressId: jobProgress.id,
    sessionId: input.sessionId,
    templateId: input.templateId,
    templateContent: input.templateContent,
    clientIds: validClientIds,
    authorId: input.authorId,
    orgId: input.orgId,
    noteType: input.noteType,
    tags: input.tags,
    variables: input.customVariables ?? {},
  }

  await addJob('mass-note-batch', jobData, {
    jobId: jobProgress.id,
  })

  return jobProgress.id
}

/**
 * Preview mass notes for clients
 */
export async function previewMassNotes(input: MassNotePreviewInput): Promise<MassNotePreview[]> {
  // Get session with related data
  const session = await prisma.programSession.findUnique({
    where: { id: input.sessionId },
    include: {
      program: {
        include: {
          facilitator: true,
        },
      },
      attendance: {
        where: {
          enrollment: {
            clientId: { in: input.clientIds },
          },
        },
        include: {
          enrollment: {
            include: {
              client: true,
            },
          },
        },
      },
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  // Get clients
  const clients = await prisma.client.findMany({
    where: {
      id: { in: input.clientIds },
      orgId: input.orgId,
    },
    take: 10, // Limit preview to 10 clients
  })

  const previews: MassNotePreview[] = []

  for (const client of clients) {
    // Find attendance for this client
    type AttendanceWithEnrollment = typeof session.attendance[number]
    const attendance = session.attendance.find(
      (a: AttendanceWithEnrollment) => a.enrollment.clientId === client.id
    )

    const context: VariableContext = {
      client: {
        firstName: client.firstName,
        lastName: client.lastName,
      },
      session: {
        title: session.title,
        date: session.date,
        topic: session.topic,
        durationMinutes: session.durationMinutes,
      },
      program: {
        name: session.program.name,
        facilitator: session.program.facilitator?.name ?? undefined,
      },
      attendance: attendance
        ? {
            type: attendance.attendanceType,
            timeIn: attendance.timeIn,
            timeOut: attendance.timeOut,
            hoursAttended: attendance.hoursAttended
              ? Number(attendance.hoursAttended)
              : null,
          }
        : undefined,
      custom: input.customVariables,
    }

    const variables = buildVariables(context)
    const resolvedContent = resolveTemplateVariables(input.templateContent, variables)

    previews.push({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      resolvedContent,
    })
  }

  return previews
}

/**
 * Get mass notes for a session
 */
export async function getMassNotesForSession(sessionId: string) {
  return prisma.note.findMany({
    where: {
      sessionId,
      isMassNote: true,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get attendees for mass note creation
 */
export async function getSessionAttendeesForMassNote(sessionId: string, orgId: string) {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: { orgId: true },
      },
      attendance: {
        include: {
          enrollment: {
            include: {
              client: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.program.orgId !== orgId) {
    throw new Error('Session does not belong to this organization')
  }

  // Filter to clients who attended
  type SessionAttendanceRecord = typeof session.attendance[number]
  const attendees = session.attendance
    .filter((a: SessionAttendanceRecord) => a.attended || a.attendanceType === 'PRESENT')
    .map((a: SessionAttendanceRecord) => ({
      clientId: a.enrollment.client.id,
      clientName: `${a.enrollment.client.firstName} ${a.enrollment.client.lastName}`,
      status: a.enrollment.client.status,
      attendanceType: a.attendanceType,
      hoursAttended: a.hoursAttended ? Number(a.hoursAttended) : null,
    }))

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    sessionDate: session.date,
    attendees,
    totalAttendees: attendees.length,
  }
}
