/**
 * Template Processor for Mass Notes
 *
 * Handles variable substitution in note templates.
 * Variables use Mustache-style syntax: {{variable.name}}
 */

import type { TemplateVariableKey } from './types'

/**
 * Context for building template variables
 */
export interface TemplateContext {
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

/**
 * Build a flat variables map from context
 */
export function buildVariables(context: TemplateContext): Record<string, string> {
  const variables: Record<string, string> = {}

  // Client variables
  variables['client.firstName'] = context.client.firstName
  variables['client.lastName'] = context.client.lastName
  variables['client.fullName'] = `${context.client.firstName} ${context.client.lastName}`

  // Session variables
  if (context.session) {
    variables['session.title'] = context.session.title
    variables['session.date'] = context.session.date
      ? formatDate(context.session.date)
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
    variables['attendance.type'] = formatAttendanceType(context.attendance.type)
    variables['attendance.timeIn'] = context.attendance.timeIn
      ? formatTime(context.attendance.timeIn)
      : ''
    variables['attendance.timeOut'] = context.attendance.timeOut
      ? formatTime(context.attendance.timeOut)
      : ''
    variables['attendance.hoursAttended'] = context.attendance.hoursAttended
      ? formatHours(context.attendance.hoursAttended)
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

/**
 * Replace template variables with actual values
 */
export function resolveTemplateVariables(
  template: string,
  variables: Record<string, string | undefined>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    const value = variables[trimmedKey]
    // Return the original placeholder if no value found
    return value !== undefined ? value : match
  })
}

/**
 * Extract variable keys used in a template
 */
export function extractVariablesFromTemplate(template: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim()
    if (!variables.includes(variable)) {
      variables.push(variable)
    }
  }

  return variables
}

/**
 * Validate that all required variables in a template are available
 */
export function validateTemplateVariables(
  template: string,
  availableVariables: string[]
): { valid: boolean; missingVariables: string[] } {
  const usedVariables = extractVariablesFromTemplate(template)
  const missingVariables = usedVariables.filter(
    (v) => !availableVariables.includes(v) && !v.startsWith('custom.')
  )

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  }
}

/**
 * Get a preview of all available variables with sample values
 */
export function getVariablePreviews(): Record<TemplateVariableKey, string> {
  return {
    'client.firstName': 'John',
    'client.lastName': 'Doe',
    'client.fullName': 'John Doe',
    'session.title': 'Session 1: Introduction',
    'session.date': 'January 15, 2026',
    'session.topic': 'Getting Started',
    'session.duration': '60 minutes',
    'program.name': 'Life Skills Workshop',
    'program.facilitator': 'Jane Smith',
    'attendance.type': 'Present',
    'attendance.timeIn': '9:00 AM',
    'attendance.timeOut': '10:00 AM',
    'attendance.hoursAttended': '1 hour',
  }
}

// Helper functions for formatting

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatAttendanceType(type: string | null): string {
  if (!type) return ''

  const typeMap: Record<string, string> = {
    PRESENT: 'Present',
    EXCUSED: 'Excused',
    ABSENT: 'Absent',
  }

  return typeMap[type] ?? type
}

function formatHours(hours: number): string {
  if (hours === 1) return '1 hour'
  if (hours < 1) return `${Math.round(hours * 60)} minutes`
  return `${hours} hours`
}
