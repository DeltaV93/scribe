/**
 * Integrations Settings Page (PX-1003)
 *
 * Allows admins to manage organization integrations:
 * - Calendar providers (Google, Outlook, Apple)
 * - Meeting platforms (Teams, Zoom, Google Meet)
 * - Workflow platforms (Linear, Notion, Jira)
 * - Communication (Slack, Gmail, Teams Chat)
 * - Coming soon integrations (Wave 2/3)
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IntegrationsContent } from "./integrations-content";
import {
  CalendarIntegrationSection,
  AdminWorkflowPlatformsSection,
  CommunicationSection,
  DocumentationSection,
  ProjectManagementSection,
  ComingSoonSection,
} from "./components";
import { Skeleton } from "@/components/ui/skeleton";

export default async function IntegrationsPage() {
  const user = await requireAuth();

  // Only admins can access integration settings
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your workflow.
        </p>
      </div>

      {/* Calendar Integration Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Calendar</h2>
        <Suspense fallback={<CalendarSkeleton />}>
          <CalendarIntegrationSection />
        </Suspense>
      </section>

      {/* Meeting Integrations Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Meeting Platforms</h2>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <IntegrationsContent />
        </Suspense>
      </section>

      {/* Workflow Platforms Section (PX-882) */}
      <section>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <AdminWorkflowPlatformsSection />
        </Suspense>
      </section>

      {/* Communication Section (PX-1003) */}
      <section>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <CommunicationSection />
        </Suspense>
      </section>

      {/* Documentation Section (PX-1003) */}
      <section>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <DocumentationSection />
        </Suspense>
      </section>

      {/* Additional Project Management Section (PX-1003) */}
      <section>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <ProjectManagementSection />
        </Suspense>
      </section>

      {/* Coming Soon Section (PX-1003) */}
      <section>
        <Suspense fallback={<IntegrationsSkeleton />}>
          <ComingSoonSection />
        </Suspense>
      </section>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
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
