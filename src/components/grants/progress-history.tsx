"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingUp, TrendingDown, User, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProgressEvent {
  id: string;
  eventType: string;
  delta: number;
  previousValue: number;
  newValue: number;
  sourceType: string;
  sourceId: string | null;
  notes: string | null;
  recordedAt: string;
  recordedBy?: {
    name: string | null;
    email: string;
  } | null;
}

interface ProgressHistoryProps {
  grantId: string;
  deliverableId: string;
  className?: string;
}

const sourceTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  manual: { label: "Manual Entry", icon: <User className="h-3 w-3" /> },
  enrollment: { label: "Enrollment", icon: <FileText className="h-3 w-3" /> },
  session: { label: "Session", icon: <Clock className="h-3 w-3" /> },
  call: { label: "Call", icon: <FileText className="h-3 w-3" /> },
  form_submission: { label: "Form Submission", icon: <FileText className="h-3 w-3" /> },
  system: { label: "System", icon: <FileText className="h-3 w-3" /> },
};

export function ProgressHistory({ grantId, deliverableId, className }: ProgressHistoryProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/grants/${grantId}/deliverables/${deliverableId}/progress?limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          setEvents(data.data.events || []);
        }
      } catch (error) {
        console.error("Error fetching progress history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [grantId, deliverableId]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Progress History</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No progress events recorded yet.
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {events.map((event) => {
                const sourceInfo = sourceTypeLabels[event.sourceType] || {
                  label: event.sourceType,
                  icon: <FileText className="h-3 w-3" />,
                };
                const isPositive = event.delta > 0;

                return (
                  <div key={event.id} className="flex gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isPositive
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {isPositive ? "+" : ""}
                          {event.delta}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({event.previousValue} → {event.newValue})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {sourceInfo.icon}
                          <span className="ml-1">{sourceInfo.label}</span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.recordedAt), { addSuffix: true })}
                        </span>
                      </div>
                      {event.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                      )}
                      {event.recordedBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {event.recordedBy.name || event.recordedBy.email}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
