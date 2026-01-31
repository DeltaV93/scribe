/**
 * Mass Note Batch Processor
 *
 * Processes mass note creation jobs, creating individual notes
 * for each client with resolved template variables.
 */

import { Job } from 'bullmq'
import { NoteType } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  MassNoteBatchJobData,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  incrementJobCompleted,
  incrementJobFailed,
} from '@/lib/jobs'
import { registerProcessor } from '../worker'
import {
  resolveTemplateVariables,
  buildVariables,
  VariableContext,
} from '@/lib/services/note-templates'
import { notifyJobCompleted, notifyJobFailed } from '@/lib/services/notifications'

const BATCH_SIZE = 50

/**
 * Process a mass note batch job
 */
async function processMassNoteBatch(job: Job<MassNoteBatchJobData>): Promise<void> {
  const {
    jobProgressId,
    sessionId,
    templateContent,
    clientIds,
    authorId,
    orgId,
    noteType,
    tags,
    variables: customVariables,
  } = job.data

  console.log(`[MassNoteBatch] Starting job ${jobProgressId} for ${clientIds.length} clients`)

  try {
    // Mark as processing
    await markJobProcessing(jobProgressId)

    // Get session with related data
    const session = await prisma.programSession.findUnique({
      where: { id: sessionId },
      include: {
        program: {
          include: {
            facilitator: true,
          },
        },
        attendance: {
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

    // Create attendance lookup map
    type AttendanceRecord = typeof session.attendance[number]
    const attendanceMap = new Map<string, AttendanceRecord>(
      session.attendance.map((a): [string, AttendanceRecord] => [a.enrollment.clientId, a])
    )

    // Process clients in batches
    let completed = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < clientIds.length; i += BATCH_SIZE) {
      const batchClientIds = clientIds.slice(i, i + BATCH_SIZE)

      // Get clients for this batch
      const clients = await prisma.client.findMany({
        where: {
          id: { in: batchClientIds },
          orgId,
        },
      })

      // Create notes for each client
      const notesToCreate = []

      for (const client of clients) {
        try {
          const attendance = attendanceMap.get(client.id)

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
            custom: customVariables,
          }

          const variables = buildVariables(context)
          const resolvedContent = resolveTemplateVariables(templateContent, variables)

          notesToCreate.push({
            clientId: client.id,
            sessionId,
            authorId,
            type: noteType as NoteType,
            content: resolvedContent,
            tags,
            isMassNote: true,
            isDraft: false,
          })
        } catch (error) {
          failed++
          errors.push(
            `Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Batch insert notes
      if (notesToCreate.length > 0) {
        try {
          await prisma.note.createMany({
            data: notesToCreate,
          })
          completed += notesToCreate.length
        } catch (error) {
          failed += notesToCreate.length
          errors.push(
            `Batch ${i / BATCH_SIZE}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      // Update progress
      await incrementJobCompleted(jobProgressId, notesToCreate.length)
      if (failed > 0) {
        await incrementJobFailed(jobProgressId, failed)
      }

      // Update job progress for UI
      const progress = Math.round(((i + batchClientIds.length) / clientIds.length) * 100)
      await job.updateProgress(progress)
    }

    // Mark as completed
    await markJobCompleted(jobProgressId, {
      completed,
      failed,
      errors: errors.slice(0, 10), // Limit stored errors
    })

    // Send notification
    await notifyJobCompleted(authorId, 'mass-note-batch', {
      count: completed,
      message: `Created ${completed} notes for session "${session.title}"`,
    })

    console.log(
      `[MassNoteBatch] Job ${jobProgressId} completed: ${completed} created, ${failed} failed`
    )
  } catch (error) {
    console.error(`[MassNoteBatch] Job ${jobProgressId} failed:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markJobFailed(jobProgressId, errorMessage)
    await notifyJobFailed(authorId, 'mass-note-batch', errorMessage)

    throw error
  }
}

// Register the processor
registerProcessor('mass-note-batch', processMassNoteBatch)

export { processMassNoteBatch }
