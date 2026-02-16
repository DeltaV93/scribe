"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Filter,
  UserCircle,
  ClipboardCheck,
  UserPlus,
  Target,
  ShieldCheck,
} from "lucide-react";

// PX-728: Activity types for filtering
type ActivityType =
  | "CALL_COMPLETED"
  | "CALL_MISSED"
  | "NOTE_ADDED"
  | "FORM_SUBMITTED"
  | "FORM_UPDATED"
  | "ATTENDANCE_RECORDED"
  | "ENROLLMENT_CREATED"
  | "ENROLLMENT_UPDATED"
  | "ACTION_ITEM_CREATED"
  | "ACTION_ITEM_COMPLETED"
  | "CONSENT_GRANTED"
  | "CONSENT_REVOKED";

// Legacy type mapping for backward compatibility
type LegacyActivityType = "call" | "note" | "submission" | "attendance" | "enrollment" | "action_item" | "consent";

interface ActivityItem {
  id: string;
  type: LegacyActivityType;
  activityType?: ActivityType; // New field from API
  title: string;
  description?: string;
  status?: string;
  timestamp: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  metadata?: {
    duration?: number;
    formName?: string;
    noteType?: string;
    callStatus?: string;
    sessionName?: string;
    programName?: string;
    attendanceStatus?: string;
  };
}

interface ClientActivityFeedProps {
  clientId: string;
  maxItems?: number;
  showFilters?: boolean;
}

// Filter options for activity types (PX-728)
const ACTIVITY_TYPE_FILTERS = [
  { value: "all", label: "All Activities" },
  { value: "calls", label: "Calls", types: ["CALL_COMPLETED", "CALL_MISSED"] },
  { value: "notes", label: "Notes", types: ["NOTE_ADDED"] },
  { value: "forms", label: "Forms", types: ["FORM_SUBMITTED", "FORM_UPDATED"] },
  { value: "attendance", label: "Attendance", types: ["ATTENDANCE_RECORDED"] },
  { value: "enrollments", label: "Enrollments", types: ["ENROLLMENT_CREATED", "ENROLLMENT_UPDATED"] },
  { value: "actions", label: "Action Items", types: ["ACTION_ITEM_CREATED", "ACTION_ITEM_COMPLETED"] },
  { value: "consent", label: "Consent", types: ["CONSENT_GRANTED", "CONSENT_REVOKED"] },
];

// Role display labels
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PROGRAM_MANAGER: "Program Manager",
  CASE_MANAGER: "Case Manager",
  FACILITATOR: "Facilitator",
  VIEWER: "Viewer",
};

const statusIcons = {
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  IN_PROGRESS: <Clock className="h-4 w-4 text-blue-500" />,
  PENDING: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

// PX-728: Extended type icons for all activity types
const typeIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  note: <MessageSquare className="h-4 w-4" />,
  submission: <FileText className="h-4 w-4" />,
  attendance: <ClipboardCheck className="h-4 w-4" />,
  enrollment: <UserPlus className="h-4 w-4" />,
  action_item: <Target className="h-4 w-4" />,
  consent: <ShieldCheck className="h-4 w-4" />,
};

// PX-728: Extended type colors
const typeColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  note: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  submission: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  attendance: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  enrollment: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  action_item: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  consent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export function ClientActivityFeed({
  clientId,
  maxItems = 20,
  showFilters = true,
}: ClientActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // PX-728: Filter state
  const [activityFilter, setActivityFilter] = useState<string>("all");

  // Get the activity types to filter by based on selected filter
  const filterTypes = useMemo(() => {
    if (activityFilter === "all") return undefined;
    const filter = ACTIVITY_TYPE_FILTERS.find((f) => f.value === activityFilter);
    return filter?.types;
  }, [activityFilter]);

  useEffect(() => {
    fetchActivities();
  }, [clientId, filterTypes]);

  const fetchActivities = async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      // PX-728: Include filter types in API call
      let url = `/api/clients/${clientId}/activity?limit=${maxItems}&offset=${offset}`;
      if (filterTypes && filterTypes.length > 0) {
        url += `&types=${filterTypes.join(",")}`;
      }

      const response = await fetch(url);

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

  if (activities.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        {/* PX-728: Filter controls */}
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Filter activities" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPE_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No activity yet</p>
          <p className="text-sm">
            {activityFilter === "all"
              ? "Calls, notes, and submissions will appear here"
              : `No ${ACTIVITY_TYPE_FILTERS.find((f) => f.value === activityFilter)?.label.toLowerCase()} found`}
          </p>
        </div>
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
    <div className="space-y-4">
      {/* PX-728: Filter controls */}
      {showFilters && (
        <div className="flex items-center gap-2 pr-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Filter activities" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPE_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activityFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivityFilter("all")}
              className="h-8 px-2 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      )}

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
                      {/* PX-728: Actor role attribution */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </span>
                        {activity.actor && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <UserCircle className="h-3 w-3" />
                              {activity.actor.name || activity.actor.email.split("@")[0]}
                              {activity.actor.role && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  {ROLE_LABELS[activity.actor.role] || activity.actor.role}
                                </Badge>
                              )}
                            </span>
                          </>
                        )}
                      </div>
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
    </div>
  );
}
