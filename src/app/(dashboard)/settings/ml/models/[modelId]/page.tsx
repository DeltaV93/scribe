/**
 * Model Detail Page
 *
 * Displays model information, versions, and deployment controls.
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Brain } from "lucide-react";
import { ModelDetailContent } from "./model-detail-content";

interface PageProps {
  params: Promise<{ modelId: string }>;
}

export default async function ModelDetailPage({ params }: PageProps) {
  const { modelId } = await params;
  const user = await requireAuth();

  // Only admins can access model details
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/ml/models">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Models
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Suspense fallback={<ModelDetailSkeleton />}>
        <ModelDetailContent modelId={modelId} />
      </Suspense>
    </div>
  );
}

function ModelDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Model Info Card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-3 gap-4 pt-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      {/* Versions Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="border rounded-lg">
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
