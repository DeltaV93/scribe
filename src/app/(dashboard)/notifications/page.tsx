"use client";

import { NotificationList } from "@/components/notifications";

export default function NotificationsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Stay updated on mentions, approvals, and important events.
        </p>
      </div>

      {/* Notification List */}
      <NotificationList initialLimit={20} />
    </div>
  );
}
