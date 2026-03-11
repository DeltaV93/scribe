/**
 * Note Templates Service
 *
 * CRUD operations for note templates used in mass notes.
 * Supports variable interpolation for client-specific content.
 */

import { NoteTemplateScope } from '@prisma/client'
import { prisma } from '@/lib/db'

// Available template variables
export const TEMPLATE_VARIABLES = {
  client: {
    firstName: '{{client.firstName}}',
    lastName: '{{client.lastName}}',
    fullName: '{{client.fullName}}',
  },
  session: {
    title: '{{session.title}}',
    date: '{{session.date}}',
    topic: '{{session.topic}}',
    duration: '{{session.duration}}',
  },
  program: {
    name: '{{program.name}}',
    facilitator: '{{program.facilitator}}',
  },
  attendance: {
    type: '{{attendance.type}}',
    timeIn: '{{attendance.timeIn}}',
    timeOut: '{{attendance.timeOut}}',
    hoursAttended: '{{attendance.hoursAttended}}',
  },
  custom: {
    // Custom variables can be passed at runtime
    placeholder: '{{custom.placeholder}}',
  },
} as const

// Flattened list of all variable keys
export const ALL_VARIABLE_KEYS = [
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
]

export interface CreateNoteTemplateInput {
  orgId: string
  createdById: string
  name: string
  content: string
  scope: NoteTemplateScope
  programId?: string
  userId?: string
  sessionType?: string
  isDefault?: boolean
}

export interface UpdateNoteTemplateInput {
  name?: string
  content?: string
  sessionType?: string
  isDefault?: boolean
}

/**
 * Create a new note template
 */
export async function createNoteTemplate(input: CreateNoteTemplateInput) {
  const availableVariables = extractVariablesFromContent(input.content)

  // If setting as default, unset other defaults in same scope
  if (input.isDefault) {
    await prisma.noteTemplate.updateMany({
      where: {
        orgId: input.orgId,
        scope: input.scope,
        programId: input.programId ?? null,
        isDefault: true,
      },
      data: { isDefault: false },
    })
  }

  return prisma.noteTemplate.create({
    data: {
      orgId: input.orgId,
      createdById: input.createdById,
      name: input.name,
      content: input.content,
      scope: input.scope,
      programId: input.programId,
      userId: input.scope === 'USER' ? input.userId : null,
      sessionType: input.sessionType,
      isDefault: input.isDefault ?? false,
      availableVariables,
    },
  })
}

/**
 * Get a note template by ID
 */
export async function getNoteTemplate(id: string) {
  return prisma.noteTemplate.findUnique({
    where: { id },
    include: {
      program: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  })
}

/**
 * Update a note template
 */
export async function updateNoteTemplate(id: string, input: UpdateNoteTemplateInput) {
  const data: Record<string, unknown> = {}

  if (input.name !== undefined) data.name = input.name
  if (input.sessionType !== undefined) data.sessionType = input.sessionType
  if (input.isDefault !== undefined) data.isDefault = input.isDefault

  if (input.content !== undefined) {
    data.content = input.content
    data.availableVariables = extractVariablesFromContent(input.content)
  }

  // If setting as default, need to handle other defaults
  if (input.isDefault) {
    const template = await prisma.noteTemplate.findUnique({ where: { id } })
    if (template) {
      await prisma.noteTemplate.updateMany({
        where: {
          orgId: template.orgId,
          scope: template.scope,
          programId: template.programId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }
  }

  return prisma.noteTemplate.update({
    where: { id },
    data,
  })
}

/**
 * Delete a note template
 */
export async function deleteNoteTemplate(id: string) {
  return prisma.noteTemplate.delete({ where: { id } })
}

/**
 * List note templates for an organization
 */
export async function listNoteTemplates(options: {
  orgId: string
  scope?: NoteTemplateScope
  programId?: string
  userId?: string
  sessionType?: string
}) {
  const where: Record<string, unknown> = {
    orgId: options.orgId,
  }

  if (options.scope) where.scope = options.scope
  if (options.programId) where.programId = options.programId
  if (options.userId) where.userId = options.userId
  if (options.sessionType) where.sessionType = options.sessionType

  return prisma.noteTemplate.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      program: {
        select: { id: true, name: true },
      },
    },
  })
}

/**
 * Get the default template for a context
 */
export async function getDefaultTemplate(options: {
  orgId: string
  programId?: string
  userId?: string
  sessionType?: string
}) {
  // Try program-level default first
  if (options.programId) {
    const programDefault = await prisma.noteTemplate.findFirst({
      where: {
        orgId: options.orgId,
        programId: options.programId,
        scope: 'PROGRAM',
        isDefault: true,
      },
    })
    if (programDefault) return programDefault
  }

  // Then org-level default
  const orgDefault = await prisma.noteTemplate.findFirst({
    where: {
      orgId: options.orgId,
      scope: 'ORG',
      isDefault: true,
    },
  })

  return orgDefault
}

/**
 * Extract variables used in template content
 */
export function extractVariablesFromContent(content: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = variablePattern.exec(content)) !== null) {
    const variable = match[1].trim()
    if (!variables.includes(variable)) {
      variables.push(variable)
    }
  }

  return variables
}

/**
 * Resolve template variables with actual values
 */
export function resolveTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    const value = variables[trimmedKey]
    return value !== undefined ? value : match
  })
}

/**
 * Build variables for a client and session context
 */
export interface VariableContext {
  client: {
    firstName: string
    lastName: string
  }
  session?: {
    title: string
    date: Date | null
    topic?: string | null
    durationMinutes?: number | null
  }
  program?: {
    name: string
    facilitator?: string | null
  }
  attendance?: {
    type: string | null
    timeIn?: Date | null
    timeOut?: Date | null
    hoursAttended?: number | null
  }
  custom?: Record<string, string>
}

export function buildVariables(context: VariableContext): Record<string, string> {
  const variables: Record<string, string> = {}

  // Client variables
  variables['client.firstName'] = context.client.firstName
  variables['client.lastName'] = context.client.lastName
  variables['client.fullName'] = `${context.client.firstName} ${context.client.lastName}`

  // Session variables
  if (context.session) {
    variables['session.title'] = context.session.title
    variables['session.date'] = context.session.date
      ? context.session.date.toLocaleDateString()
      : ''
    variables['session.topic'] = context.session.topic ?? ''
    variables['session.duration'] = context.session.durationMinutes
      ? `${context.session.durationMinutes} minutes`
      : ''
  }

  // Program variables
  if (context.program) {
    variables['program.name'] = context.program.name
    variables['program.facilitator'] = context.program.facilitator ?? ''
  }

  // Attendance variables
  if (context.attendance) {
    variables['attendance.type'] = context.attendance.type ?? ''
    variables['attendance.timeIn'] = context.attendance.timeIn
      ? context.attendance.timeIn.toLocaleTimeString()
      : ''
    variables['attendance.timeOut'] = context.attendance.timeOut
      ? context.attendance.timeOut.toLocaleTimeString()
      : ''
    variables['attendance.hoursAttended'] = context.attendance.hoursAttended
      ? context.attendance.hoursAttended.toString()
      : ''
  }

  // Custom variables
  if (context.custom) {
    for (const [key, value] of Object.entries(context.custom)) {
      variables[`custom.${key}`] = value
    }
  }

  return variables
}
