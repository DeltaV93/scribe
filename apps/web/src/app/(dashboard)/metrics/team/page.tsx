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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StaffMetricsCard,
  MetricsTrendChart,
  TeamMetricsTable,
  OutcomeMetricsCard,
} from "@/components/metrics";
import { Loader2, Calendar as CalendarIcon, Users, ShieldAlert } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import Link from "next/link";

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

interface TeamMemberMetrics {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  activity: ActivityMetrics;
  outcomes: OutcomeMetrics;
}

interface TeamMetrics {
  supervisorId: string;
  teamSize: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  aggregateActivity: ActivityMetrics;
  aggregateOutcomes: OutcomeMetrics;
  memberMetrics: TeamMemberMetrics[];
  trend: TrendDataPoint[];
}

type DatePreset = "7d" | "30d" | "90d" | "custom";

export default function TeamMetricsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);

    try {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.set("startDate", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        params.set("endDate", endOfDay(dateRange.to).toISOString());
      }

      const response = await fetch(`/api/metrics/team?${params.toString()}`);
      const data = await response.json();

      if (response.status === 403) {
        setIsForbidden(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch team metrics");
      }

      setMetrics(data.data);
    } catch (err) {
      console.error("Error fetching team metrics:", err);
      setError(err instanceof Error ? err.message : "Failed to load team metrics");
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
        break;
    }
  };

  if (isForbidden) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Team metrics are only available to supervisors, program managers, and administrators.
          </p>
          <Button asChild>
            <Link href="/metrics">View My Metrics</Link>
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Team Metrics</h1>
          <p className="text-muted-foreground">
            View aggregate performance for your team
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
          {/* Team Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Team Overview</CardTitle>
              </div>
              <CardDescription>
                {metrics.teamSize} team member{metrics.teamSize !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Aggregate Activity Summary */}
          <StaffMetricsCard activity={metrics.aggregateActivity} />

          {/* Aggregate Outcomes */}
          <OutcomeMetricsCard outcomes={metrics.aggregateOutcomes} />

          {/* Activity Trend */}
          <MetricsTrendChart data={metrics.trend} height={300} />

          {/* Individual Team Member Metrics */}
          <TeamMetricsTable members={metrics.memberMetrics} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No team metrics data available</p>
        </div>
      )}
    </div>
  );
}
