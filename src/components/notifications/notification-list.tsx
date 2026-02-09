"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationListProps {
  initialLimit?: number;
  className?: string;
}

/**
 * Get the appropriate icon for a notification type
 */
function getNotificationIcon(type: string) {
  switch (type) {
    case "MENTION":
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "APPROVAL_REQUEST":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "APPROVAL_RESULT":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "REMINDER":
      return <AlertCircle className="h-5 w-5 text-orange-500" />;
    case "SYSTEM":
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

/**
 * Notification list component with infinite scroll
 */
export function NotificationList({
  initialLimit = 20,
  className,
}: NotificationListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams({
        limit: initialLimit.toString(),
      });

      if (loadMore && cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.data?.notifications ?? [];

        if (loadMore) {
          setNotifications((prev) => [...prev, ...newNotifications]);
        } else {
          setNotifications(newNotifications);
        }

        setCursor(data.data?.cursor);
        setHasMore(data.data?.hasMore ?? false);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [cursor, initialLimit]);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Navigate to action URL if present
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleLoadMore = () => {
    fetchNotifications(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">
            No notifications
          </h3>
          <p className="text-sm text-muted-foreground/75 mt-1">
            You&apos;re all caught up!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Mark All Read button */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
          >
            {isMarkingAllRead ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            Mark all as read
          </Button>
        </div>
      )}

      {/* Notification list */}
      <Card>
        <CardContent className="p-0">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              {index > 0 && <Separator />}
              <button
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                  !notification.isRead && "bg-primary/5"
                )}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={cn(
                          "text-sm font-medium",
                          !notification.isRead && "font-semibold"
                        )}
                      >
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>

                    {notification.body && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.body}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground/75 mt-2">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default NotificationList;
