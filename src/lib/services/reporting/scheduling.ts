/**
 * Report Scheduling Service
 *
 * Manages scheduled report generation and execution.
 */

import { prisma } from "@/lib/db";
import { ReportStatus } from "@prisma/client";

// ============================================
// SCHEDULE PRESETS (Reuse from exports scheduling)
// ============================================

export const REPORT_SCHEDULE_PRESETS = {
  DAILY_6AM: "0 6 * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  WEEKLY_MONDAY_6AM: "0 6 * * 1",
  WEEKLY_FRIDAY_5PM: "0 17 * * 5",
  MONTHLY_1ST_6AM: "0 6 1 * *",
  MONTHLY_15TH_6AM: "0 6 15 * *",
  QUARTERLY_1ST: "0 6 1 1,4,7,10 *",
  ANNUALLY_JAN_1: "0 6 1 1 *",
} as const;

export type ReportSchedulePreset = keyof typeof REPORT_SCHEDULE_PRESETS;

// ============================================
// CRON PARSING (Reuse logic from exports)
// ============================================

export interface CronComponents {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values: number[] = [];

  if (field === "L") {
    return [-1];
  }

  const parts = field.split(",");

  for (const part of parts) {
    if (part === "*") {
      for (let i = min; i <= max; i++) {
        values.push(i);
      }
    } else if (part.includes("/")) {
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
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
    } else {
      values.push(parseInt(part, 10));
    }
  }

  return [...new Set(values)].sort((a, b) => a - b);
}

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

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getNextRunTime(
  cronExpression: string,
  timezone: string = "America/Los_Angeles",
  fromDate: Date = new Date()
): Date {
  const cron = parseCron(cronExpression);

  const current = new Date(fromDate);
  current.setSeconds(0);
  current.setMilliseconds(0);
  current.setMinutes(current.getMinutes() + 1);

  const maxDate = new Date(fromDate);
  maxDate.setFullYear(maxDate.getFullYear() + 2);

  while (current < maxDate) {
    const month = current.getMonth() + 1;
    const dayOfMonth = current.getDate();
    const dayOfWeek = current.getDay();
    const hour = current.getHours();
    const minute = current.getMinutes();

    if (!cron.month.includes(month)) {
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
      current.setHours(0);
      current.setMinutes(0);
      continue;
    }

    const lastDay = getLastDayOfMonth(current.getFullYear(), current.getMonth());
    const matchesDayOfMonth =
      cron.dayOfMonth.includes(dayOfMonth) ||
      (cron.dayOfMonth.includes(-1) && dayOfMonth === lastDay);

    const matchesDayOfWeek = cron.dayOfWeek.includes(dayOfWeek);

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
      matchesDay = matchesDayOfMonth || matchesDayOfWeek;
    }

    if (!matchesDay) {
      current.setDate(current.getDate() + 1);
      current.setHours(0);
      current.setMinutes(0);
      continue;
    }

    if (!cron.hour.includes(hour)) {
      const nextHour = cron.hour.find((h) => h > hour);
      if (nextHour !== undefined) {
        current.setHours(nextHour);
        current.setMinutes(cron.minute[0]);
      } else {
        current.setDate(current.getDate() + 1);
        current.setHours(0);
        current.setMinutes(0);
      }
      continue;
    }

    if (!cron.minute.includes(minute)) {
      const nextMinute = cron.minute.find((m) => m > minute);
      if (nextMinute !== undefined) {
        current.setMinutes(nextMinute);
      } else {
        current.setHours(current.getHours() + 1);
        current.setMinutes(0);
      }
      continue;
    }

    return current;
  }

  throw new Error("Could not find next run time within 2 years");
}

export function describeCron(cronExpression: string): string {
  for (const [name, expr] of Object.entries(REPORT_SCHEDULE_PRESETS)) {
    if (expr === cronExpression) {
      return formatPresetName(name);
    }
  }

  try {
    const cron = parseCron(cronExpression);
    const timeStr = formatTime(cron.hour[0], cron.minute[0]);

    if (
      cron.dayOfMonth.length === 31 &&
      cron.month.length === 12 &&
      cron.dayOfWeek.length === 7
    ) {
      return `Daily at ${timeStr}`;
    }

    if (
      cron.dayOfMonth.length === 31 &&
      cron.month.length === 12 &&
      cron.dayOfWeek.length === 1
    ) {
      const dayName = getDayName(cron.dayOfWeek[0]);
      return `Weekly on ${dayName} at ${timeStr}`;
    }

    if (cron.dayOfWeek.length === 7 && cron.month.length === 12) {
      if (cron.dayOfMonth.includes(-1)) {
        return `Monthly on last day at ${timeStr}`;
      }
      const dayOrdinal = getOrdinal(cron.dayOfMonth[0]);
      return `Monthly on the ${dayOrdinal} at ${timeStr}`;
    }

    if (cron.dayOfWeek.length === 7 && cron.month.length < 12) {
      return `Quarterly at ${timeStr}`;
    }

    return cronExpression;
  } catch {
    return cronExpression;
  }
}

function formatPresetName(name: string): string {
  return name
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
// REPORTING PERIOD CALCULATION
// ============================================

export function calculateReportingPeriod(cronExpression: string): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const cron = parseCron(cronExpression);

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

  const isQuarterly =
    cron.dayOfWeek.length === 7 && cron.month.length === 4;

  const isAnnual = cron.month.length === 1 && cron.dayOfMonth.length === 1;

  if (isDaily) {
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 1);
    return { periodStart, periodEnd };
  }

  if (isWeekly) {
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    return { periodStart, periodEnd };
  }

  if (isMonthly) {
    const periodEnd = new Date(now);
    periodEnd.setDate(1);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);
    return { periodStart, periodEnd };
  }

  if (isQuarterly) {
    const periodEnd = new Date(now);
    periodEnd.setDate(1);
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 3);
    return { periodStart, periodEnd };
  }

  if (isAnnual) {
    const periodEnd = new Date(now.getFullYear(), 0, 1);
    const periodStart = new Date(now.getFullYear() - 1, 0, 1);
    return { periodStart, periodEnd };
  }

  // Default: last 30 days
  const periodEnd = new Date(now);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);
  return { periodStart, periodEnd };
}

// ============================================
// SCHEDULE MANAGEMENT (Using ReportTemplate metadata)
// ============================================

export interface ReportScheduleInput {
  templateId: string;
  orgId: string;
  enabled: boolean;
  cronExpression: string;
  timezone?: string;
  distributionSettings?: {
    enabled: boolean;
    recipients: Array<{
      email: string;
      name?: string;
      type: "to" | "cc" | "bcc";
    }>;
    subject?: string;
    message?: string;
    attachPdf: boolean;
  };
}

/**
 * Get all available schedule presets
 */
export function getSchedulePresets(): Array<{
  id: ReportSchedulePreset;
  label: string;
  cronExpression: string;
  description: string;
}> {
  return [
    {
      id: "DAILY_6AM",
      label: "Daily at 6:00 AM",
      cronExpression: REPORT_SCHEDULE_PRESETS.DAILY_6AM,
      description: "Generate report every day at 6:00 AM",
    },
    {
      id: "WEEKLY_MONDAY_6AM",
      label: "Weekly on Monday",
      cronExpression: REPORT_SCHEDULE_PRESETS.WEEKLY_MONDAY_6AM,
      description: "Generate report every Monday at 6:00 AM",
    },
    {
      id: "WEEKLY_FRIDAY_5PM",
      label: "Weekly on Friday",
      cronExpression: REPORT_SCHEDULE_PRESETS.WEEKLY_FRIDAY_5PM,
      description: "Generate report every Friday at 5:00 PM",
    },
    {
      id: "MONTHLY_1ST_6AM",
      label: "Monthly on 1st",
      cronExpression: REPORT_SCHEDULE_PRESETS.MONTHLY_1ST_6AM,
      description: "Generate report on the 1st of each month",
    },
    {
      id: "MONTHLY_15TH_6AM",
      label: "Monthly on 15th",
      cronExpression: REPORT_SCHEDULE_PRESETS.MONTHLY_15TH_6AM,
      description: "Generate report on the 15th of each month",
    },
    {
      id: "QUARTERLY_1ST",
      label: "Quarterly",
      cronExpression: REPORT_SCHEDULE_PRESETS.QUARTERLY_1ST,
      description: "Generate report at the start of each quarter",
    },
    {
      id: "ANNUALLY_JAN_1",
      label: "Annually",
      cronExpression: REPORT_SCHEDULE_PRESETS.ANNUALLY_JAN_1,
      description: "Generate report on January 1st each year",
    },
  ];
}

/**
 * Get common timezone options
 */
export function getTimezoneOptions(): Array<{
  value: string;
  label: string;
}> {
  return [
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
    { value: "UTC", label: "UTC" },
  ];
}
