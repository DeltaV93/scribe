/**
 * Meeting Integrations Settings Page
 *
 * Allows users to connect/disconnect meeting platforms (Teams, Zoom, Google Meet)
 * and manage integration settings.
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IntegrationsContent } from "./integrations-content";
import { Skeleton } from "@/components/ui/skeleton";

export default async function IntegrationsPage() {
  const user = await requireAuth();

  // Only admins can access integration settings
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect meeting platforms to automatically capture and process recordings.
        </p>
      </div>

      {/* Integrations Content */}
      <Suspense fallback={<IntegrationsSkeleton />}>
        <IntegrationsContent />
      </Suspense>
    </div>
  );
}

function IntegrationsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-6 space-y-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
