"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import { DeliverableProgress } from "./deliverable-progress";
import { DeliverableStatus, MetricType } from "@prisma/client";
import { format } from "date-fns";
import { Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliverableCardProps {
  deliverable: {
    id: string;
    name: string;
    description: string | null;
    metricType: MetricType;
    targetValue: number;
    currentValue: number;
    status: DeliverableStatus;
    dueDate: string | null;
  };
  onClick?: () => void;
  className?: string;
}

const metricTypeLabels: Record<MetricType, string> = {
  CLIENT_CONTACTS: "Client Contacts",
  CLIENTS_ENROLLED: "Clients Enrolled",
  PROGRAM_COMPLETIONS: "Program Completions",
  CLIENTS_HOUSED: "Clients Housed",
  SESSIONS_DELIVERED: "Sessions Delivered",
  FORM_SUBMISSIONS: "Form Submissions",
  CUSTOM: "Custom Metric",
};

export function DeliverableCard({ deliverable, onClick, className }: DeliverableCardProps) {
  const percentage = deliverable.targetValue > 0
    ? Math.round((deliverable.currentValue / deliverable.targetValue) * 100)
    : 0;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium line-clamp-2">
            {deliverable.name}
          </CardTitle>
          <DeliverableStatusBadge status={deliverable.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>{metricTypeLabels[deliverable.metricType]}</span>
        </div>

        <DeliverableProgress
          currentValue={deliverable.currentValue}
          targetValue={deliverable.targetValue}
          size="md"
        />

        {deliverable.dueDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Due {format(new Date(deliverable.dueDate), "MMM d, yyyy")}</span>
          </div>
        )}

        {deliverable.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {deliverable.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
