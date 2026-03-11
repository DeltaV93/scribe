"use client";

/**
 * Schedule Configuration Component
 *
 * UI for configuring export schedule settings.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar, Clock, Settings, Loader2, Check, Info } from "lucide-react";

interface ScheduleConfigProps {
  templateId: string;
  templateName: string;
  currentSchedule: {
    enabled: boolean;
    cronExpression: string | null;
    description: string | null;
    timezone: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  onSave?: (schedule: ScheduleSettings) => void;
}

export interface ScheduleSettings {
  enabled: boolean;
  frequency: string;
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
  cronExpression?: string;
}

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom (Cron)" },
];

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "UTC", label: "UTC" },
];

/**
 * Parse existing cron to determine frequency settings
 */
function parseCronToSettings(cron: string | null): Partial<ScheduleSettings> {
  if (!cron) return { frequency: "daily", time: "06:00" };

  const parts = cron.split(" ");
  if (parts.length !== 5) return { frequency: "custom", cronExpression: cron };

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check for common patterns
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    // Daily
    return {
      frequency: "daily",
      time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
    };
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    // Weekly
    return {
      frequency: "weekly",
      time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
      dayOfWeek: parseInt(dayOfWeek, 10),
    };
  }

  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    // Monthly
    return {
      frequency: "monthly",
      time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
      dayOfMonth: parseInt(dayOfMonth, 10),
    };
  }

  return { frequency: "custom", cronExpression: cron };
}

/**
 * Build cron expression from settings
 */
function buildCronExpression(settings: ScheduleSettings): string {
  if (settings.frequency === "custom" && settings.cronExpression) {
    return settings.cronExpression;
  }

  const [hour, minute] = settings.time.split(":").map(Number);

  switch (settings.frequency) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${settings.dayOfWeek ?? 1}`;
    case "monthly":
      return `${minute} ${hour} ${settings.dayOfMonth ?? 1} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

export function ScheduleConfigDialog({
  templateId,
  templateName,
  currentSchedule,
  onSave,
}: ScheduleConfigProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initialSettings = parseCronToSettings(currentSchedule.cronExpression);
  const [settings, setSettings] = useState<ScheduleSettings>({
    enabled: currentSchedule.enabled,
    frequency: initialSettings.frequency || "daily",
    time: initialSettings.time || "06:00",
    dayOfWeek: initialSettings.dayOfWeek ?? 1,
    dayOfMonth: initialSettings.dayOfMonth ?? 1,
    timezone: currentSchedule.timezone || "America/Los_Angeles",
    cronExpression: initialSettings.cronExpression,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const cronExpression = buildCronExpression(settings);

      const res = await fetch(`/api/exports/templates/${templateId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          cronExpression,
          timezone: settings.timezone,
        }),
      });

      if (res.ok) {
        setSaved(true);
        onSave?.(settings);
        setTimeout(() => {
          setSaved(false);
          setOpen(false);
        }, 1000);
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configure Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Schedule</DialogTitle>
          <DialogDescription>
            Configure automatic exports for {templateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-enabled">Enable Scheduling</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate exports on schedule
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enabled: checked })
              }
            />
          </div>

          {settings.enabled && (
            <>
              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={settings.frequency}
                  onValueChange={(value) =>
                    setSettings({ ...settings, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time */}
              {settings.frequency !== "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="schedule-time">Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="schedule-time"
                      type="time"
                      value={settings.time}
                      onChange={(e) =>
                        setSettings({ ...settings, time: e.target.value })
                      }
                      className="w-32"
                    />
                  </div>
                </div>
              )}

              {/* Day of Week (for weekly) */}
              {settings.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={String(settings.dayOfWeek)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, dayOfWeek: parseInt(value, 10) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {settings.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Select
                    value={String(settings.dayOfMonth)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, dayOfMonth: parseInt(value, 10) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}{getOrdinalSuffix(day)}
                        </SelectItem>
                      ))}
                      <SelectItem value="-1">Last day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Cron */}
              {settings.frequency === "custom" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="cron-expression">Cron Expression</Label>
                    <Popover>
                      <PopoverTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="text-sm space-y-2">
                          <p className="font-medium">Cron Format</p>
                          <p className="text-muted-foreground">
                            minute hour day month weekday
                          </p>
                          <div className="text-xs space-y-1">
                            <p>
                              <code>0 6 * * *</code> - Daily at 6 AM
                            </p>
                            <p>
                              <code>0 6 * * 1</code> - Weekly Monday at 6 AM
                            </p>
                            <p>
                              <code>0 6 1 * *</code> - Monthly on 1st at 6 AM
                            </p>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Input
                    id="cron-expression"
                    value={settings.cronExpression || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, cronExpression: e.target.value })
                    }
                    placeholder="0 6 * * *"
                    className="font-mono"
                  />
                </div>
              )}

              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) =>
                    setSettings({ ...settings, timezone: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium">Schedule Preview</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getScheduleDescription(settings)}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            {saved ? "Saved" : "Save Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function getScheduleDescription(settings: ScheduleSettings): string {
  if (!settings.enabled) return "Scheduling disabled";

  const time = formatTime(settings.time);
  const tz = TIMEZONE_OPTIONS.find((t) => t.value === settings.timezone)?.label || settings.timezone;

  switch (settings.frequency) {
    case "daily":
      return `Every day at ${time} (${tz})`;
    case "weekly":
      const dayName = DAY_OPTIONS.find((d) => d.value === settings.dayOfWeek)?.label || "Monday";
      return `Every ${dayName} at ${time} (${tz})`;
    case "monthly":
      const dayOfMonth = settings.dayOfMonth === -1
        ? "last day"
        : `${settings.dayOfMonth}${getOrdinalSuffix(settings.dayOfMonth ?? 1)}`;
      return `Monthly on the ${dayOfMonth} at ${time} (${tz})`;
    case "custom":
      return `Custom: ${settings.cronExpression} (${tz})`;
    default:
      return "Unknown schedule";
  }
}

function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/**
 * Inline schedule indicator component
 */
export function ScheduleIndicator({
  enabled,
  description,
  nextRunAt,
}: {
  enabled: boolean;
  description: string | null;
  nextRunAt: string | null;
}) {
  if (!enabled) {
    return (
      <span className="text-sm text-muted-foreground">Not scheduled</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-green-500" />
      <div>
        <p className="text-sm">{description}</p>
        {nextRunAt && (
          <p className="text-xs text-muted-foreground">
            Next: {new Date(nextRunAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
