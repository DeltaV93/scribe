/**
 * Scheduled Export Service
 *
 * Manages scheduled export execution, cron parsing, and next run calculations.
 */

import { prisma } from "@/lib/db";
import { ExportTemplateStatus } from "@prisma/client";
import { generateExport } from "./index";

// ============================================
// CRON PARSING
// ============================================

/**
 * Common schedule presets
 */
export const SCHEDULE_PRESETS = {
  DAILY_6AM: "0 6 * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  WEEKLY_MONDAY_6AM: "0 6 * * 1",
  WEEKLY_FRIDAY_5PM: "0 17 * * 5",
  MONTHLY_1ST_6AM: "0 6 1 * *",
  MONTHLY_LAST_DAY: "0 6 L * *",
  QUARTERLY_1ST: "0 6 1 1,4,7,10 *",
} as const;

export type SchedulePreset = keyof typeof SCHEDULE_PRESETS;

/**
 * Parse a cron expression into components
 * Supports standard 5-field cron: minute hour day month weekday
 */
export interface CronComponents {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

/**
 * Parse a single cron field
 */
function parseCronField(
  field: string,
  min: number,
  max: number
): number[] {
  const values: number[] = [];

  // Handle special 'L' for last day of month
  if (field === "L") {
    return [-1]; // Special marker for last day
  }

  const parts = field.split(",");

  for (const part of parts) {
    if (part === "*") {
      // Every value
      for (let i = min; i <= max; i++) {
        values.push(i);
      }
    } else if (part.includes("/")) {
      // Step values: */5 or 0-30/5
      const [range, step] = part.split("/");
      const stepNum = parseInt(step, 10);
      let start = min;
      let end = max;

      if (range !== "*") {
        if (range.includes("-")) {
          [start, end] = range.split("-").map(Number);
        } else {
          start = parseInt(range, 10);
        }
      }

      for (let i = start; i <= end; i += stepNum) {
        values.push(i);
      }
    } else if (part.includes("-")) {
      // Range: 1-5
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
    } else {
      // Single value
      values.push(parseInt(part, 10));
    }
  }

  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Parse a cron expression
 */
export function parseCron(expression: string): CronComponents {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length}`
    );
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

/**
 * Get the last day of a month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the next run time from a cron expression
 */
export function getNextRunTime(
  cronExpression: string,
  timezone: string = "America/Los_Angeles",
  fromDate: Date = new Date()
): Date {
  const cron = parseCron(cronExpression);

  // Start from the next minute
  const current = new Date(fromDate);
  current.setSeconds(0);
  current.setMilliseconds(0);
  current.setMinutes(current.getMinutes() + 1);

  // Search up to 2 years ahead
  const maxDate = new Date(fromDate);
  maxDate.setFullYear(maxDate.getFullYear() + 2);

  while (current < maxDate) {
    const month = current.getMonth() + 1; // 1-12
    const dayOfMonth = current.getDate();
    const dayOfWeek = current.getDay();
    const hour = current.getHours();
    const minute = current.getMinutes();

    // Check month
    if (!cron.month.includes(month)) {
      // Jump to first day of next matching month
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
      current.setHours(0);
      current.setMinutes(0);
      continue;
    }

    // Check day of month (handle 'L' for last day)
    const lastDay = getLastDayOfMonth(current.getFullYear(), current.getMonth());
    const matchesDayOfMonth =
      cron.dayOfMonth.includes(dayOfMonth) ||
      (cron.dayOfMonth.includes(-1) && dayOfMonth === lastDay);

    // Check day of week
    const matchesDayOfWeek = cron.dayOfWeek.includes(dayOfWeek);

    // Standard cron: day of month AND day of week must match
    // (unless one is *, in which case only the other needs to match)
    const dayOfMonthIsAny = cron.dayOfMonth.length === 31;
    const dayOfWeekIsAny = cron.dayOfWeek.length === 7;

    let matchesDay: boolean;
    if (dayOfMonthIsAny && dayOfWeekIsAny) {
      matchesDay = true;
    } else if (dayOfMonthIsAny) {
      matchesDay = matchesDayOfWeek;
    } else if (dayOfWeekIsAny) {
      matchesDay = matchesDayOfMonth;
    } else {
      // Both specified - use OR logic (standard cron behavior)
      matchesDay = matchesDayOfMonth || matchesDayOfWeek;
    }

    if (!matchesDay) {
      current.setDate(current.getDate() + 1);
      current.setHours(0);
      current.setMinutes(0);
      continue;
    }

    // Check hour
    if (!cron.hour.includes(hour)) {
      // Find next matching hour
      const nextHour = cron.hour.find((h) => h > hour);
      if (nextHour !== undefined) {
        current.setHours(nextHour);
        current.setMinutes(cron.minute[0]);
      } else {
        // No matching hour today, try tomorrow
        current.setDate(current.getDate() + 1);
        current.setHours(0);
        current.setMinutes(0);
      }
      continue;
    }

    // Check minute
    if (!cron.minute.includes(minute)) {
      // Find next matching minute
      const nextMinute = cron.minute.find((m) => m > minute);
      if (nextMinute !== undefined) {
        current.setMinutes(nextMinute);
      } else {
        // No matching minute this hour, try next hour
        current.setHours(current.getHours() + 1);
        current.setMinutes(0);
      }
      continue;
    }

    // All conditions matched
    return current;
  }

  throw new Error("Could not find next run time within 2 years");
}

/**
 * Get a human-readable description of a cron expression
 */
export function describeCron(cronExpression: string): string {
  // Check for presets
  for (const [name, expr] of Object.entries(SCHEDULE_PRESETS)) {
    if (expr === cronExpression) {
      return formatPresetName(name);
    }
  }

  try {
    const cron = parseCron(cronExpression);

    const timeStr = formatTime(cron.hour[0], cron.minute[0]);

    // Daily
    if (
      cron.dayOfMonth.length === 31 &&
      cron.month.length === 12 &&
      cron.dayOfWeek.length === 7
    ) {
      return `Daily at ${timeStr}`;
    }

    // Weekly
    if (
      cron.dayOfMonth.length === 31 &&
      cron.month.length === 12 &&
      cron.dayOfWeek.length === 1
    ) {
      const dayName = getDayName(cron.dayOfWeek[0]);
      return `Weekly on ${dayName} at ${timeStr}`;
    }

    // Monthly
    if (cron.dayOfWeek.length === 7 && cron.month.length === 12) {
      if (cron.dayOfMonth.includes(-1)) {
        return `Monthly on last day at ${timeStr}`;
      }
      const dayOrdinal = getOrdinal(cron.dayOfMonth[0]);
      return `Monthly on the ${dayOrdinal} at ${timeStr}`;
    }

    return cronExpression;
  } catch {
    return cronExpression;
  }
}

function formatPresetName(name: string): string {
  const formatted = name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return formatted;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const minuteStr = minute.toString().padStart(2, "0");
  return `${hour12}:${minuteStr} ${period}`;
}

function getDayName(day: number): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[day];
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================
// SCHEDULED EXPORT MANAGEMENT
// ============================================

/**
 * Update schedule for a template
 */
export async function updateTemplateSchedule(
  templateId: string,
  orgId: string,
  schedule: {
    enabled: boolean;
    cronExpression?: string;
    timezone?: string;
  }
): Promise<{
  success: boolean;
  nextRunAt?: Date;
  error?: string;
}> {
  // Validate cron expression if provided
  if (schedule.enabled && schedule.cronExpression) {
    try {
      parseCron(schedule.cronExpression);
    } catch (error) {
      return {
        success: false,
        error: `Invalid cron expression: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  if (template.status !== "ACTIVE") {
    return {
      success: false,
      error: "Only active templates can be scheduled",
    };
  }

  // Calculate next run time
  let nextRunAt: Date | undefined;
  if (schedule.enabled && schedule.cronExpression) {
    try {
      nextRunAt = getNextRunTime(
        schedule.cronExpression,
        schedule.timezone || template.scheduleTimezone
      );
    } catch (error) {
      return {
        success: false,
        error: `Could not calculate next run time: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  await prisma.exportTemplate.update({
    where: { id: templateId },
    data: {
      scheduleEnabled: schedule.enabled,
      scheduleCron: schedule.cronExpression || template.scheduleCron,
      scheduleTimezone: schedule.timezone || template.scheduleTimezone,
      nextScheduledRunAt: nextRunAt || null,
      scheduleFailureCount: 0, // Reset failure count on schedule change
    },
  });

  return { success: true, nextRunAt };
}

/**
 * Get templates that are due for scheduled export
 */
export async function getTemplatesDueForExport(): Promise<
  Array<{
    id: string;
    orgId: string;
    name: string;
    exportType: string;
    scheduleCron: string;
    scheduleTimezone: string;
    createdById: string;
  }>
> {
  const now = new Date();

  const templates = await prisma.exportTemplate.findMany({
    where: {
      scheduleEnabled: true,
      status: "ACTIVE",
      scheduleCron: { not: null },
      nextScheduledRunAt: { lte: now },
      scheduleFailureCount: { lt: 3 }, // Skip templates that have failed 3+ times
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      exportType: true,
      scheduleCron: true,
      scheduleTimezone: true,
      createdById: true,
    },
  });

  return templates as Array<{
    id: string;
    orgId: string;
    name: string;
    exportType: string;
    scheduleCron: string;
    scheduleTimezone: string;
    createdById: string;
  }>;
}

/**
 * Execute a scheduled export for a template
 */
export async function executeScheduledExport(
  templateId: string
): Promise<{
  success: boolean;
  exportId?: string;
  error?: string;
}> {
  const template = await prisma.exportTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      orgId: true,
      scheduleCron: true,
      scheduleTimezone: true,
      createdById: true,
    },
  });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  if (!template.scheduleCron) {
    return { success: false, error: "Template has no schedule configured" };
  }

  try {
    // Calculate the reporting period based on schedule frequency
    const { periodStart, periodEnd } = calculateReportingPeriod(
      template.scheduleCron
    );

    // Generate the export
    const result = await generateExport({
      templateId: template.id,
      orgId: template.orgId,
      userId: template.createdById, // Use template creator as the generator
      periodStart,
      periodEnd,
    });

    // Calculate next run time
    const nextRunAt = getNextRunTime(
      template.scheduleCron,
      template.scheduleTimezone
    );

    // Update template with next run time
    await prisma.exportTemplate.update({
      where: { id: templateId },
      data: {
        lastScheduledRunAt: new Date(),
        nextScheduledRunAt: nextRunAt,
        scheduleFailureCount: 0, // Reset on success
      },
    });

    return { success: true, exportId: result.exportId };
  } catch (error) {
    // Increment failure count
    await prisma.exportTemplate.update({
      where: { id: templateId },
      data: {
        scheduleFailureCount: { increment: 1 },
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate the reporting period based on schedule frequency
 * Daily → yesterday
 * Weekly → last 7 days
 * Monthly → last month
 */
function calculateReportingPeriod(cronExpression: string): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const cron = parseCron(cronExpression);

  // Determine frequency from cron
  const isDaily =
    cron.dayOfMonth.length === 31 &&
    cron.month.length === 12 &&
    cron.dayOfWeek.length === 7;

  const isWeekly =
    cron.dayOfMonth.length === 31 &&
    cron.month.length === 12 &&
    cron.dayOfWeek.length === 1;

  const isMonthly =
    cron.dayOfWeek.length === 7 &&
    cron.month.length === 12 &&
    cron.dayOfMonth.length < 31;

  if (isDaily) {
    // Yesterday
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 1);
    return { periodStart, periodEnd };
  }

  if (isWeekly) {
    // Last 7 days
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    return { periodStart, periodEnd };
  }

  if (isMonthly) {
    // Last month
    const periodEnd = new Date(now);
    periodEnd.setDate(1); // First of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);
    return { periodStart, periodEnd };
  }

  // Default: last 30 days
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);
  return { periodStart, periodEnd };
}

// ============================================
// SCHEDULE STATUS
// ============================================

/**
 * Get schedule status for all templates in an organization
 */
export async function getScheduleStatus(orgId: string): Promise<
  Array<{
    templateId: string;
    templateName: string;
    exportType: string;
    scheduleEnabled: boolean;
    scheduleCron: string | null;
    scheduleDescription: string | null;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    failureCount: number;
    lastExport: {
      id: string;
      status: string;
      recordCount: number | null;
      createdAt: Date;
    } | null;
  }>
> {
  const templates = await prisma.exportTemplate.findMany({
    where: {
      orgId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      exportType: true,
      scheduleEnabled: true,
      scheduleCron: true,
      lastScheduledRunAt: true,
      nextScheduledRunAt: true,
      scheduleFailureCount: true,
      exports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          recordCount: true,
          createdAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return templates.map((t) => ({
    templateId: t.id,
    templateName: t.name,
    exportType: t.exportType,
    scheduleEnabled: t.scheduleEnabled,
    scheduleCron: t.scheduleCron,
    scheduleDescription: t.scheduleCron ? describeCron(t.scheduleCron) : null,
    lastRunAt: t.lastScheduledRunAt,
    nextRunAt: t.nextScheduledRunAt,
    failureCount: t.scheduleFailureCount,
    lastExport: t.exports[0] || null,
  }));
}

/**
 * Get upcoming scheduled exports across all organizations
 * Used for monitoring/admin purposes
 */
export async function getUpcomingScheduledExports(
  limit: number = 20
): Promise<
  Array<{
    templateId: string;
    templateName: string;
    orgId: string;
    exportType: string;
    nextRunAt: Date;
    scheduleDescription: string;
  }>
> {
  const templates = await prisma.exportTemplate.findMany({
    where: {
      scheduleEnabled: true,
      status: "ACTIVE",
      nextScheduledRunAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      orgId: true,
      exportType: true,
      scheduleCron: true,
      nextScheduledRunAt: true,
    },
    orderBy: { nextScheduledRunAt: "asc" },
    take: limit,
  });

  return templates.map((t) => ({
    templateId: t.id,
    templateName: t.name,
    orgId: t.orgId,
    exportType: t.exportType,
    nextRunAt: t.nextScheduledRunAt!,
    scheduleDescription: t.scheduleCron ? describeCron(t.scheduleCron) : "Unknown",
  }));
}
