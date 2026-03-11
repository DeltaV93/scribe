"use client";

import { format } from "date-fns";
import { CheckCircle, User, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarProvider } from "@prisma/client";

interface Tier1EventCardProps {
  event: {
    id: string;
    externalEventId: string;
    provider: CalendarProvider;
    title: string;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
    clientInvited: boolean;
    status: "CREATED" | "UPDATED" | "DELETED";
  };
  className?: string;
}

/**
 * Get the provider icon/badge for a calendar provider
 */
function ProviderBadge({ provider }: { provider: CalendarProvider }) {
  const providerConfig: Record<CalendarProvider, { label: string; className: string }> = {
    GOOGLE: { label: "Google", className: "bg-blue-100 text-blue-700 border-blue-200" },
    OUTLOOK: { label: "Outlook", className: "bg-sky-100 text-sky-700 border-sky-200" },
    APPLE: { label: "Apple", className: "bg-gray-100 text-gray-700 border-gray-200" },
  };

  const config = providerConfig[provider];

  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

/**
 * Tier1EventCard - Displays a successfully created calendar event
 *
 * Shows green checkmark, event details, provider info, and client invitation status.
 */
export function Tier1EventCard({ event, className }: Tier1EventCardProps) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  return (
    <Card className={cn("border-green-200 bg-green-50/50", className)}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {/* Success icon */}
          <div className="flex-shrink-0 mt-0.5">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  {event.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>
                    {format(startDate, "MMM d, yyyy")} at{" "}
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                  </span>
                </div>
              </div>

              {/* Provider badge */}
              <ProviderBadge provider={event.provider} />
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="success" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Added to calendar
              </Badge>

              {event.isRecurring && (
                <Badge variant="outline" className="text-xs">
                  Recurring
                </Badge>
              )}

              {event.clientInvited && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Client invited
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Tier1EventCard;
