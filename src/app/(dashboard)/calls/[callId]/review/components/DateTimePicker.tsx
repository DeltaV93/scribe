"use client";

import { useState } from "react";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type RecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  daysOfWeek?: number[];
  until?: string;
}

interface DateTimePickerProps {
  initialDate?: Date;
  showRecurrence?: boolean;
  recurrenceHint?: string;
  onConfirm: (params: {
    startTime: string;
    endTime?: string;
    recurrence?: RecurrenceConfig;
  }) => Promise<void>;
  onCancel: () => void;
}

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Monthly" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/**
 * Generate time options for a 24-hour period in 15-minute intervals
 */
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = 6; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeValue = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      const date = new Date();
      date.setHours(hour, minute);
      options.push({
        value: timeValue,
        label: format(date, "h:mm a"),
      });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

/**
 * DateTimePicker - Inline form for scheduling a calendar event
 *
 * Provides date picker, time picker, duration selector, and optional recurrence options.
 */
export function DateTimePicker({
  initialDate,
  showRecurrence = false,
  recurrenceHint,
  onConfirm,
  onCancel,
}: DateTimePickerProps) {
  const [date, setDate] = useState<Date | undefined>(initialDate ?? new Date());
  const [time, setTime] = useState<string>("10:00");
  const [duration, setDuration] = useState<string>("60");
  const [isRecurring, setIsRecurring] = useState(showRecurrence);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("WEEKLY");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDayToggle = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleConfirm = async () => {
    if (!date) return;

    setIsSubmitting(true);
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const startDateTime = setMinutes(setHours(date, hours), minutes);
      const durationMinutes = parseInt(duration, 10);
      const endDateTime = addHours(startDateTime, durationMinutes / 60);

      const params: {
        startTime: string;
        endTime?: string;
        recurrence?: RecurrenceConfig;
      } = {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      };

      if (isRecurring) {
        params.recurrence = {
          frequency,
          ...(frequency === "WEEKLY" && daysOfWeek.length > 0
            ? { daysOfWeek }
            : {}),
          ...(endDate ? { until: endDate.toISOString() } : {}),
        };
      }

      await onConfirm(params);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        {/* Date Picker */}
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Picker */}
        <div className="space-y-2">
          <Label>Time</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label>Duration</Label>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger>
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recurrence Toggle */}
      {showRecurrence && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked === true)}
            />
            <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
              Make this a recurring event
              {recurrenceHint && (
                <span className="text-muted-foreground ml-1">
                  (suggested: {recurrenceHint})
                </span>
              )}
            </Label>
          </div>

          {isRecurring && (
            <div className="pl-6 space-y-4 border-l-2 border-muted ml-2">
              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={frequency}
                  onValueChange={(val) => setFrequency(val as RecurrenceFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Days of Week (for weekly frequency) */}
              {frequency === "WEEKLY" && (
                <div className="space-y-2">
                  <Label>Days of week</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={daysOfWeek.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        className="w-10"
                        onClick={() => handleDayToggle(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* End Date */}
              <div className="space-y-2">
                <Label>End date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "No end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(d) => d < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!date || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Event"
          )}
        </Button>
      </div>
    </div>
  );
}

export default DateTimePicker;
