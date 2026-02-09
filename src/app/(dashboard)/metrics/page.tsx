"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  StaffMetricsCard,
  MetricsTrendChart,
  ProgramContributionChart,
  OutcomeMetricsCard,
  OKRProgressWidget,
} from "@/components/metrics";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ActivityMetrics {
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
}

interface OutcomeMetrics {
  caseClosureRate: number;
  programCompletionRate: number;
  goalAchievement: number;
  totalCasesHandled: number;
  totalCasesClosed: number;
  totalEnrollments: number;
  totalCompletions: number;
}

interface TrendDataPoint {
  date: string;
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
}

interface ProgramContribution {
  programId: string;
  programName: string;
  callsCompleted: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
  totalActivities: number;
}

interface LinkedOKR {
  objectiveId: string;
  objectiveTitle: string;
  progress: number;
  keyResultCount: number;
  completedKeyResults: number;
}

interface StaffMetrics {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  activity: ActivityMetrics;
  outcomes: OutcomeMetrics;
  trend: TrendDataPoint[];
  programContributions: ProgramContribution[];
  linkedOKRs: LinkedOKR[];
}

type DatePreset = "7d" | "30d" | "90d" | "custom";

export default function MetricsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StaffMetrics | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.set("startDate", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        params.set("endDate", endOfDay(dateRange.to).toISOString());
      }

      const response = await fetch(`/api/metrics/me?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch metrics");
      }

      setMetrics(data.data);
    } catch (err) {
      console.error("Error fetching metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    switch (preset) {
      case "7d":
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case "30d":
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case "90d":
        setDateRange({ from: subDays(now, 90), to: now });
        break;
      case "custom":
        // Keep current range, just enable custom picker
        break;
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchMetrics}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Metrics</h1>
          <p className="text-muted-foreground">
            Track your activity and outcomes
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Pick a date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Activity Summary */}
          <StaffMetricsCard activity={metrics.activity} />

          {/* Outcomes */}
          <OutcomeMetricsCard outcomes={metrics.outcomes} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Trend */}
            <MetricsTrendChart data={metrics.trend} height={250} />

            {/* OKR Progress */}
            <OKRProgressWidget okrs={metrics.linkedOKRs} />
          </div>

          {/* Program Contributions */}
          <ProgramContributionChart data={metrics.programContributions} height={300} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No metrics data available</p>
        </div>
      )}
    </div>
  );
}
