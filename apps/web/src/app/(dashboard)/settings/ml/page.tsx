/**
 * ML Settings Page
 *
 * Overview of ML services status, privacy budget, and compliance.
 * Admin-only page for managing ML infrastructure.
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Brain, Settings2 } from "lucide-react";
import { MLSettingsContent } from "./ml-settings-content";

export default async function MLSettingsPage() {
  const user = await requireAuth();

  // Only admins can access ML settings
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            ML Services
          </h1>
          <p className="text-muted-foreground">
            Manage ML models, monitor privacy budget, and view compliance status.
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/ml/models">
            <Settings2 className="h-4 w-4 mr-2" />
            Model Registry
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Content */}
      <Suspense fallback={<MLSettingsSkeleton />}>
        <MLSettingsContent />
      </Suspense>
    </div>
  );
}

function MLSettingsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
