"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NotificationBellProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Notification bell icon with unread count badge
 * Polls for unread count every 30 seconds
 */
export function NotificationBell({ collapsed, className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data?.count ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Render based on collapsed state
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/notifications"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md mx-auto relative",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              className
            )}
          >
            <Bell className="h-5 w-5" />
            {!isLoading && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href="/notifications"
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <div className="relative">
        <Bell className="h-5 w-5" />
        {!isLoading && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
        )}
      </div>
      <span className="flex-1">Notifications</span>
      {!isLoading && unreadCount > 0 && (
        <span className="text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
