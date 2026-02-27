/**
 * Date Resolution Service
 *
 * Parses relative and absolute date/time references from natural language,
 * using a provided anchor date (typically the call timestamp) for context.
 */

import {
  addDays,
  addWeeks,
  addMonths,
  setHours,
  setMinutes,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  isValid,
  startOfDay,
} from 'date-fns'
import type { DateResolutionResult, DateResolutionInput } from './types'

// ============================================
// CONSTANTS
// ============================================

/** Default business hours time when time not specified */
const DEFAULT_HOUR = 10 // 10 AM
const DEFAULT_MINUTE = 0

/** Day name to next day function mapping */
const NEXT_DAY_FUNCTIONS: Record<string, (date: Date) => Date> = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
}

/** Month name to number mapping */
const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

// ============================================
// TIME PARSING
// ============================================

interface ParsedTime {
  hour: number
  minute: number
  confidence: number
}

/**
 * Parse time from natural language
 *
 * Handles:
 * - "2pm", "2:30pm", "14:00"
 * - "at 2", "at 2pm", "at 14:00"
 * - "2 o'clock", "2 in the afternoon"
 * - "morning", "afternoon", "evening"
 */
export function parseTime(text: string): ParsedTime | null {
  const lower = text.toLowerCase().trim()

  // Try explicit time patterns first (highest confidence)

  // Pattern: HH:mm or H:mm (24h format)
  const time24Match = lower.match(/\b(\d{1,2}):(\d{2})\b/)
  if (time24Match) {
    const hour = parseInt(time24Match[1], 10)
    const minute = parseInt(time24Match[2], 10)
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute, confidence: 0.95 }
    }
  }

  // Pattern: Ham/pm or H:MMam/pm
  const time12Match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/)
  if (time12Match) {
    let hour = parseInt(time12Match[1], 10)
    const minute = time12Match[2] ? parseInt(time12Match[2], 10) : 0
    const isPM = time12Match[3].startsWith('p')

    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (isPM && hour !== 12) hour += 12
      if (!isPM && hour === 12) hour = 0
      return { hour, minute, confidence: 0.95 }
    }
  }

  // Pattern: "at H" (assume PM for business hours)
  const atHourMatch = lower.match(/\bat\s+(\d{1,2})\b(?!\s*:)/)
  if (atHourMatch) {
    let hour = parseInt(atHourMatch[1], 10)
    if (hour >= 1 && hour <= 12) {
      // Assume PM for typical business hours (1-6)
      if (hour >= 1 && hour <= 6) hour += 12
      return { hour, minute: 0, confidence: 0.7 }
    }
  }

  // Pattern: "H o'clock"
  const oclockMatch = lower.match(/\b(\d{1,2})\s*o'?clock\b/)
  if (oclockMatch) {
    let hour = parseInt(oclockMatch[1], 10)
    if (hour >= 1 && hour <= 12) {
      // Assume PM for typical business hours
      if (hour >= 1 && hour <= 6) hour += 12
      return { hour, minute: 0, confidence: 0.7 }
    }
  }

  // Vague time references (lower confidence)
  if (lower.includes('morning') || lower.includes('in the morning')) {
    return { hour: 9, minute: 0, confidence: 0.5 }
  }
  if (lower.includes('afternoon') || lower.includes('in the afternoon')) {
    return { hour: 14, minute: 0, confidence: 0.5 }
  }
  if (lower.includes('evening') || lower.includes('in the evening')) {
    return { hour: 17, minute: 0, confidence: 0.5 }
  }
  if (lower.includes('noon') || lower.includes('midday')) {
    return { hour: 12, minute: 0, confidence: 0.8 }
  }

  return null
}

// ============================================
// DATE PARSING
// ============================================

interface ParsedDate {
  date: Date
  confidence: number
}

/**
 * Parse date from natural language using anchor for relative references
 *
 * Handles:
 * - "today", "tomorrow"
 * - "next Monday", "this Friday"
 * - "in 2 days", "in a week"
 * - "March 5th", "3/15", "2024-03-15"
 */
export function parseDate(text: string, anchorDate: Date): ParsedDate | null {
  const lower = text.toLowerCase().trim()

  // Today
  if (lower === 'today' || lower.includes('today')) {
    return { date: startOfDay(anchorDate), confidence: 0.95 }
  }

  // Tomorrow
  if (lower === 'tomorrow' || lower.includes('tomorrow')) {
    return { date: startOfDay(addDays(anchorDate, 1)), confidence: 0.95 }
  }

  // Day after tomorrow
  if (lower.includes('day after tomorrow')) {
    return { date: startOfDay(addDays(anchorDate, 2)), confidence: 0.9 }
  }

  // Next [day of week]
  for (const [dayName, nextDayFn] of Object.entries(NEXT_DAY_FUNCTIONS)) {
    if (lower.includes(`next ${dayName}`)) {
      return { date: startOfDay(nextDayFn(anchorDate)), confidence: 0.9 }
    }
    // Also handle "this [day]" which might mean next occurrence
    if (lower.includes(`this ${dayName}`) || lower.match(new RegExp(`\\b${dayName}\\b`))) {
      const next = nextDayFn(anchorDate)
      return { date: startOfDay(next), confidence: 0.85 }
    }
  }

  // In X days/weeks/months
  const inDaysMatch = lower.match(/in\s+(\d+)\s+days?/)
  if (inDaysMatch) {
    return {
      date: startOfDay(addDays(anchorDate, parseInt(inDaysMatch[1], 10))),
      confidence: 0.9,
    }
  }

  const inWeeksMatch = lower.match(/in\s+(\d+)\s+weeks?/)
  if (inWeeksMatch) {
    return {
      date: startOfDay(addWeeks(anchorDate, parseInt(inWeeksMatch[1], 10))),
      confidence: 0.9,
    }
  }

  const inMonthsMatch = lower.match(/in\s+(\d+)\s+months?/)
  if (inMonthsMatch) {
    return {
      date: startOfDay(addMonths(anchorDate, parseInt(inMonthsMatch[1], 10))),
      confidence: 0.9,
    }
  }

  // "a week" / "a couple weeks"
  if (lower.includes('a week') || lower.includes('one week')) {
    return { date: startOfDay(addWeeks(anchorDate, 1)), confidence: 0.85 }
  }
  if (lower.includes('couple weeks') || lower.includes('two weeks') || lower.includes('2 weeks')) {
    return { date: startOfDay(addWeeks(anchorDate, 2)), confidence: 0.85 }
  }

  // Month + day: "March 5th", "March 5", "5th of March"
  const monthDayMatch = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/
  )
  if (monthDayMatch) {
    const month = MONTH_MAP[monthDayMatch[1]]
    const day = parseInt(monthDayMatch[2], 10)
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = anchorDate.getFullYear()
      const targetDate = new Date(year, month, day)
      // If date is in the past, assume next year
      if (targetDate < anchorDate) {
        year += 1
      }
      return { date: new Date(year, month, day), confidence: 0.9 }
    }
  }

  // Day + of + month: "5th of March"
  const dayOfMonthMatch = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/
  )
  if (dayOfMonthMatch) {
    const day = parseInt(dayOfMonthMatch[1], 10)
    const month = MONTH_MAP[dayOfMonthMatch[2]]
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = anchorDate.getFullYear()
      const targetDate = new Date(year, month, day)
      if (targetDate < anchorDate) {
        year += 1
      }
      return { date: new Date(year, month, day), confidence: 0.9 }
    }
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) {
    const parsed = new Date(isoMatch[0])
    if (isValid(parsed)) {
      return { date: startOfDay(parsed), confidence: 0.95 }
    }
  }

  // US format: M/D or M/D/YY or M/D/YYYY
  const usDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (usDateMatch) {
    const month = parseInt(usDateMatch[1], 10) - 1
    const day = parseInt(usDateMatch[2], 10)
    let year = usDateMatch[3]
      ? parseInt(usDateMatch[3], 10)
      : anchorDate.getFullYear()

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900
    }

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day)
      if (isValid(parsed)) {
        // If no year was specified and date is in past, use next year
        if (!usDateMatch[3] && parsed < anchorDate) {
          return { date: new Date(year + 1, month, day), confidence: 0.85 }
        }
        return { date: startOfDay(parsed), confidence: 0.9 }
      }
    }
  }

  return null
}

// ============================================
// COMBINED RESOLUTION
// ============================================

/**
 * Resolve a date/time reference to an actual Date object
 *
 * Uses the call timestamp as anchor for relative references.
 * If time is not specified, defaults to business hours.
 */
export function resolveDateTimeReference(
  input: DateResolutionInput
): DateResolutionResult {
  const { dateText, timeText, anchorDate } = input
  const combinedText = timeText ? `${dateText} ${timeText}` : dateText

  // Try to parse date
  const parsedDate = parseDate(combinedText, anchorDate)
  if (!parsedDate) {
    return {
      success: false,
      confidence: 0,
      timeExplicit: false,
      error: `Could not parse date from: "${dateText}"`,
    }
  }

  // Try to parse time
  const parsedTime = parseTime(combinedText)

  // Combine date and time
  let resultDate = parsedDate.date
  let timeExplicit = false
  let timeConfidence = 0.5 // Default confidence for assumed time

  if (parsedTime) {
    resultDate = setMinutes(setHours(resultDate, parsedTime.hour), parsedTime.minute)
    timeExplicit = parsedTime.confidence >= 0.7
    timeConfidence = parsedTime.confidence
  } else {
    // Default to business hours
    resultDate = setMinutes(setHours(resultDate, DEFAULT_HOUR), DEFAULT_MINUTE)
  }

  // Combined confidence
  const confidence = Math.min(parsedDate.confidence, timeConfidence)

  return {
    success: true,
    date: resultDate,
    confidence,
    timeExplicit,
  }
}

// ============================================
// TIER DETERMINATION
// ============================================

/**
 * Determine if a date/time reference qualifies as Tier 1 (auto-schedulable)
 *
 * Tier 1 requires:
 * - Successfully parsed date
 * - Explicit time specified (not defaulted)
 * - High confidence (>= 0.7)
 */
export function isTier1Eligible(resolution: DateResolutionResult): boolean {
  return (
    resolution.success &&
    resolution.timeExplicit &&
    resolution.confidence >= 0.7
  )
}

/**
 * Check if text contains vague time references
 */
export function isVagueTimeReference(text: string): boolean {
  const lower = text.toLowerCase()
  const vaguePatterns = [
    /\bsoon\b/,
    /\bsometime\b/,
    /\blater\b/,
    /\beventually\b/,
    /\bwhen\s+(possible|available|convenient)\b/,
    /\bat\s+some\s+point\b/,
    /\bin\s+a\s+(few|couple)\s+(days|weeks)\b/,
    /\bnext\s+week\b/, // "next week" without specific day is vague
    /\bthis\s+week\b/,
    /\bsometime\s+(next|this)\s+week\b/,
    /\blet'?s\s+(talk|meet|connect|catch\s+up)\b/,
    /\bwe\s+should\s+(meet|talk|connect)\b/,
    /\bfollow\s+up\b/,
    /\breconnect\b/,
    /\bcheck\s+(back|in)\b/,
  ]

  return vaguePatterns.some((pattern) => pattern.test(lower))
}

/**
 * Extract vague reference text for Tier 2 items
 */
export function extractVagueReference(text: string): string | null {
  const lower = text.toLowerCase()
  const patterns = [
    /\b(soon)\b/,
    /\b(sometime)\b/,
    /\b(later)\b/,
    /\b(eventually)\b/,
    /\b(when\s+(?:possible|available|convenient))\b/,
    /\b(at\s+some\s+point)\b/,
    /\b(in\s+a\s+(?:few|couple)\s+(?:days|weeks))\b/,
    /\b(next\s+week)\b/,
    /\b(this\s+week)\b/,
    /\b(sometime\s+(?:next|this)\s+week)\b/,
  ]

  for (const pattern of patterns) {
    const match = lower.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}
