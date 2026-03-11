"use client";

/**
 * BusinessHoursNotice - Shows when outside business hours
 *
 * @see PX-713 - Real-Time Chat
 */

import { Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessHoursNoticeProps {
  message: string;
  nextAvailableTime?: string;
  className?: string;
}

export function BusinessHoursNotice({
  message,
  nextAvailableTime,
  className,
}: BusinessHoursNoticeProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-yellow-200 bg-yellow-50 p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Clock className="h-5 w-5 text-yellow-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-800">
            Outside Business Hours
          </h4>
          <p className="mt-1 text-sm text-yellow-700">{message}</p>
          {nextAvailableTime && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-yellow-600">
              <Calendar className="h-4 w-4" />
              <span>Next available: {nextAvailableTime}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
