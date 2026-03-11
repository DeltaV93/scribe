"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface TrendDataPoint {
  date: string;
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
}

interface MetricsTrendChartProps {
  data: TrendDataPoint[];
  className?: string;
  showTitle?: boolean;
  height?: number;
}

const METRIC_COLORS = {
  callsCompleted: "#3b82f6", // blue-500
  messagesSent: "#22c55e", // green-500
  formsCompleted: "#a855f7", // purple-500
  sessionsDelivered: "#f97316", // orange-500
};

const METRIC_LABELS = {
  callsCompleted: "Calls",
  messagesSent: "Messages",
  formsCompleted: "Forms",
  sessionsDelivered: "Sessions",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const date = parseISO(label);

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="font-medium mb-2">{format(date, "MMM d, yyyy")}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {METRIC_LABELS[entry.dataKey as keyof typeof METRIC_LABELS]}:
          </span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MetricsTrendChart({
  data,
  className,
  showTitle = true,
  height = 300,
}: MetricsTrendChartProps) {
  // Format dates for display
  const formattedData = data.map((point) => ({
    ...point,
    displayDate: format(parseISO(point.date), "MMM d"),
  }));

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Activity Trends</CardTitle>
          <CardDescription>Daily activity over the selected period</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showTitle && "pt-6")}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={formattedData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value: string) =>
                METRIC_LABELS[value as keyof typeof METRIC_LABELS]
              }
            />
            <Line
              type="monotone"
              dataKey="callsCompleted"
              stroke={METRIC_COLORS.callsCompleted}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="messagesSent"
              stroke={METRIC_COLORS.messagesSent}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="formsCompleted"
              stroke={METRIC_COLORS.formsCompleted}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="sessionsDelivered"
              stroke={METRIC_COLORS.sessionsDelivered}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
