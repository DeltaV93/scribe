/**
 * Model Registry Page
 *
 * List all ML models with filtering, search, and create functionality.
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Brain } from "lucide-react";
import { ModelRegistryContent } from "./model-registry-content";

export default async function ModelRegistryPage() {
  const user = await requireAuth();

  // Only admins can access model registry
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings/ml">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to ML Settings
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Model Registry
          </h1>
          <p className="text-muted-foreground">
            Manage ML models, versions, and deployments.
          </p>
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<ModelRegistrySkeleton />}>
        <ModelRegistryContent />
      </Suspense>
    </div>
  );
}

function ModelRegistrySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border rounded-lg">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
