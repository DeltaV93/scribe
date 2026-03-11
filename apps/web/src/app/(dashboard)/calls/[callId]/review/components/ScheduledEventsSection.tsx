"use client";

import { useState, useEffect } from "react";
import { Calendar, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Tier1EventCard } from "./Tier1EventCard";
import { Tier2PendingCard } from "./Tier2PendingCard";
import { ConflictCard } from "./ConflictCard";
import type { CalendarProvider } from "@prisma/client";

// ============================================
// TYPES
// ============================================

interface CalendarEvent {
  id: string;
  externalEventId: string;
  provider: CalendarProvider;
  title: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  clientInvited: boolean;
  status: "CREATED" | "UPDATED" | "DELETED";
}

interface PendingItem {
  id: string;
  clientName: string;
  extractedContext: string;
  extractedDateHint?: string;
  hasRecurrence: boolean;
  recurrencePattern?: string;
  tier: "TIER_1_CONFLICT" | "TIER_2_VAGUE";
  conflictDetails?: {
    conflictingEventTitle: string;
    conflictingEventTime: string;
  };
  createdAt: string;
}

interface CalendarEventsResponse {
  events: CalendarEvent[];
  pendingItems: PendingItem[];
}

type RecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  daysOfWeek?: number[];
  until?: string;
}

interface ScheduledEventsSectionProps {
  callId: string;
}

// ============================================
// COMPONENT
// ============================================

/**
 * ScheduledEventsSection - Container for calendar events from a call
 *
 * Displays:
 * - Successfully created events (Tier 1 success) with green checkmark
 * - Pending items (Tier 2 or Tier 1 conflicts) requiring review
 * - Empty state if no scheduling detected
 */
export function ScheduledEventsSection({ callId }: ScheduledEventsSectionProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch calendar events on mount
  useEffect(() => {
    fetchCalendarEvents();
  }, [callId]);

  const fetchCalendarEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/calls/${callId}/calendar-events`);

      if (!response.ok) {
        if (response.status === 404) {
          // No calendar events for this call - not an error
          setEvents([]);
          setPendingItems([]);
          return;
        }
        throw new Error("Failed to fetch calendar events");
      }

      const data: CalendarEventsResponse = await response.json();
      setEvents(data.events ?? []);
      setPendingItems(data.pendingItems ?? []);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
      setError("Failed to load calendar events");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (params: {
    pendingItemId: string;
    startTime: string;
    endTime?: string;
    recurrence?: RecurrenceConfig;
  }) => {
    try {
      const response = await fetch("/api/scheduling/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create event");
      }

      const result = await response.json();

      // Optimistic update: Remove from pending, refresh to get new event
      setPendingItems((prev) =>
        prev.filter((item) => item.id !== params.pendingItemId)
      );

      toast.success("Calendar event created", {
        description: "The event has been added to your calendar.",
      });

      // Refresh to get the created event
      fetchCalendarEvents();
    } catch (err) {
      console.error("Error approving schedule:", err);
      toast.error("Failed to create event", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      throw err;
    }
  };

  const handleDismiss = async (pendingItemId: string) => {
    try {
      const response = await fetch("/api/scheduling/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingItemId }),
      });

      if (!response.ok) {
        throw new Error("Failed to dismiss");
      }

      // Optimistic update: Remove from pending
      setPendingItems((prev) =>
        prev.filter((item) => item.id !== pendingItemId)
      );

      toast.success("Item dismissed");
    } catch (err) {
      console.error("Error dismissing:", err);
      toast.error("Failed to dismiss item");
      throw err;
    }
  };

  // Don't show the section if loading or there's nothing to show
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no events and no pending items
  if (events.length === 0 && pendingItems.length === 0) {
    return null; // Don't show the section at all if there's nothing
  }

  // Separate conflicts from vague items
  const conflictItems = pendingItems.filter((item) => item.tier === "TIER_1_CONFLICT");
  const vagueItems = pendingItems.filter((item) => item.tier === "TIER_2_VAGUE");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Events
        </CardTitle>
        <CardDescription>
          Calendar events detected from this call
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Created events */}
        {events.map((event) => (
          <Tier1EventCard key={event.id} event={event} />
        ))}

        {/* Conflict items */}
        {conflictItems.map((item) => (
          <ConflictCard
            key={item.id}
            item={{ ...item, tier: "TIER_1_CONFLICT" }}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        ))}

        {/* Vague/pending items */}
        {vagueItems.map((item) => (
          <Tier2PendingCard
            key={item.id}
            item={{ ...item, tier: "TIER_2_VAGUE" }}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default ScheduledEventsSection;
