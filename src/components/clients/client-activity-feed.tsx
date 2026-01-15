"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  FileText,
  MessageSquare,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "call" | "note" | "submission";
  title: string;
  description?: string;
  status?: string;
  timestamp: string;
  metadata?: {
    duration?: number;
    formName?: string;
    noteType?: string;
    callStatus?: string;
  };
}

interface ClientActivityFeedProps {
  clientId: string;
  maxItems?: number;
}

const statusIcons = {
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  IN_PROGRESS: <Clock className="h-4 w-4 text-blue-500" />,
  PENDING: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

const typeIcons = {
  call: <Phone className="h-4 w-4" />,
  note: <MessageSquare className="h-4 w-4" />,
  submission: <FileText className="h-4 w-4" />,
};

const typeColors = {
  call: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  note: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  submission: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export function ClientActivityFeed({
  clientId,
  maxItems = 20,
}: ClientActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [clientId]);

  const fetchActivities = async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/activity?limit=${maxItems}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }

      const data = await response.json();

      if (data.success) {
        if (offset === 0) {
          setActivities(data.data.activities);
        } else {
          setActivities((prev) => [...prev, ...data.data.activities]);
        }
        setHasMore(data.data.hasMore);
      } else {
        throw new Error(data.error?.message || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activities");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchActivities()} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No activity yet</p>
        <p className="text-sm">Calls, notes, and submissions will appear here</p>
      </div>
    );
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.timestamp), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 pr-4">
        {Object.entries(groupedActivities).map(([date, items]) => (
          <div key={date}>
            <div className="sticky top-0 bg-background py-1 z-10">
              <h4 className="text-sm font-medium text-muted-foreground">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </h4>
            </div>
            <div className="space-y-2 mt-2">
              {items.map((activity) => (
                <div
                  key={activity.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => toggleExpanded(activity.id)}
                  >
                    <div
                      className={`p-2 rounded-full ${typeColors[activity.type]}`}
                    >
                      {typeIcons[activity.type]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {activity.title}
                        </span>
                        {activity.status && (
                          <span className="flex-shrink-0">
                            {statusIcons[activity.status as keyof typeof statusIcons]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {expandedItems.has(activity.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {expandedItems.has(activity.id) && (
                    <div className="mt-3 pl-12 space-y-2">
                      <Separator />
                      {activity.description && (
                        <p className="text-sm text-muted-foreground">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {activity.metadata?.duration && (
                          <Badge variant="outline" className="text-xs">
                            Duration: {formatDuration(activity.metadata.duration)}
                          </Badge>
                        )}
                        {activity.metadata?.formName && (
                          <Badge variant="outline" className="text-xs">
                            Form: {activity.metadata.formName}
                          </Badge>
                        )}
                        {activity.metadata?.noteType && (
                          <Badge variant="outline" className="text-xs">
                            {activity.metadata.noteType}
                          </Badge>
                        )}
                        {activity.metadata?.callStatus && (
                          <Badge variant="outline" className="text-xs">
                            {activity.metadata.callStatus}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.timestamp), "h:mm a")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {hasMore && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchActivities(activities.length)}
              disabled={loadingMore}
            >
              {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Load More
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
