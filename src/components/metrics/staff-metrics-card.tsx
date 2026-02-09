"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Phone, MessageSquare, FileCheck, Users, UserCheck } from "lucide-react";

interface ActivityMetrics {
  callsCompleted: number;
  messagesSent: number;
  formsCompleted: number;
  sessionsDelivered: number;
  clientsContacted: number;
}

interface StaffMetricsCardProps {
  activity: ActivityMetrics;
  className?: string;
  showTitle?: boolean;
}

interface MetricItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function MetricItem({ label, value, icon, color }: MetricItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn("p-2 rounded-md", color)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function StaffMetricsCard({
  activity,
  className,
  showTitle = true,
}: StaffMetricsCardProps) {
  const totalActivities =
    activity.callsCompleted +
    activity.messagesSent +
    activity.formsCompleted +
    activity.sessionsDelivered;

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle>Activity Summary</CardTitle>
          <CardDescription>
            {totalActivities.toLocaleString()} total activities
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(!showTitle && "pt-6")}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricItem
            label="Calls Completed"
            value={activity.callsCompleted}
            icon={<Phone className="h-4 w-4 text-white" />}
            color="bg-blue-500"
          />
          <MetricItem
            label="Messages Sent"
            value={activity.messagesSent}
            icon={<MessageSquare className="h-4 w-4 text-white" />}
            color="bg-green-500"
          />
          <MetricItem
            label="Forms Completed"
            value={activity.formsCompleted}
            icon={<FileCheck className="h-4 w-4 text-white" />}
            color="bg-purple-500"
          />
          <MetricItem
            label="Sessions Delivered"
            value={activity.sessionsDelivered}
            icon={<Users className="h-4 w-4 text-white" />}
            color="bg-orange-500"
          />
          <MetricItem
            label="Clients Contacted"
            value={activity.clientsContacted}
            icon={<UserCheck className="h-4 w-4 text-white" />}
            color="bg-cyan-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
