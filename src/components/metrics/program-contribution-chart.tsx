"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface ProgramContribution {
  programId: string;
  programName: string;
  callsCompleted: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
  totalActivities: number;
}

interface ProgramContributionChartProps {
  data: ProgramContribution[];
  className?: string;
  showTitle?: boolean;
  height?: number;
  maxPrograms?: number;
}

const ACTIVITY_COLORS = {
  callsCompleted: "#3b82f6", // blue-500
  formsCompleted: "#a855f7", // purple-500
  sessionsDelivered: "#f97316", // orange-500
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const program = payload[0]?.payload as ProgramContribution;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="font-medium mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Calls:</span>
          <span className="font-medium">{program.callsCompleted}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Forms:</span>
          <span className="font-medium">{program.formsCompleted}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Sessions:</span>
          <span className="font-medium">{program.sessionsDelivered}</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1 mt-1">
          <span className="text-muted-foreground">Clients:</span>
          <span className="font-medium">{program.clientsContacted}</span>
        </div>
      </div>
    </div>
  );
}

export function ProgramContributionChart({
  data,
  className,
  showTitle = true,
  height = 300,
  maxPrograms = 10,
}: ProgramContributionChartProps) {
  // Take top N programs by total activities
  const topPrograms = data
    .slice(0, maxPrograms)
    .map((program) => ({
      ...program,
      // Truncate long program names
      displayName:
        program.programName.length > 20
          ? `${program.programName.slice(0, 17)}...`
          : program.programName,
    }));

  if (topPrograms.length === 0) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle>Program Contributions</CardTitle>
            <CardDescription>Activities by program</CardDescription>
          </CardHeader>
        )}
        <CardContent className="flex items-center justify-center h-[200px]">
          <p className="text-muted-foreground">No program activity data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Program Contributions</CardTitle>
          <CardDescription>
            Breakdown of activities across {topPrograms.length} program
            {topPrograms.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showTitle && "pt-6")}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={topPrograms}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  callsCompleted: "Calls",
                  formsCompleted: "Forms",
                  sessionsDelivered: "Sessions",
                };
                return labels[value] || value;
              }}
            />
            <Bar
              dataKey="callsCompleted"
              stackId="a"
              fill={ACTIVITY_COLORS.callsCompleted}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="formsCompleted"
              stackId="a"
              fill={ACTIVITY_COLORS.formsCompleted}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="sessionsDelivered"
              stackId="a"
              fill={ACTIVITY_COLORS.sessionsDelivered}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
