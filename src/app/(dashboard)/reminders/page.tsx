"use client";

import { useState } from "react";
import { ReminderList, ReminderForm, ReminderStats } from "@/components/reminders";

export default function RemindersPage() {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground">
          Manage your follow-up tasks and scheduled reminders.
        </p>
      </div>

      {/* Stats */}
      <ReminderStats className="mb-6" />

      {/* Reminder List */}
      <ReminderList
        key={refreshKey}
        myOnly={true}
        onCreateClick={() => setShowForm(true)}
      />

      {/* Create Form */}
      <ReminderForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
