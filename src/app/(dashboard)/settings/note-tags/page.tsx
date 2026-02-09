/**
 * Note Tags Settings Page
 *
 * Admin page for managing predefined note tags.
 * Tags can be org-wide or program-specific.
 */

import { Suspense } from "react";
import { requireAuth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NoteTagsContent } from "./note-tags-content";
import { Skeleton } from "@/components/ui/skeleton";

export default async function NoteTagsPage() {
  const user = await requireAuth();

  // Only admins can access tag settings
  if (!isAdmin(user)) {
    redirect("/settings?error=unauthorized");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Note Tags</h1>
        <p className="text-muted-foreground">
          Manage predefined tags for client notes. Tags help organize and filter notes.
        </p>
      </div>

      {/* Note Tags Content */}
      <Suspense fallback={<NoteTagsSkeleton />}>
        <NoteTagsContent />
      </Suspense>
    </div>
  );
}

function NoteTagsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Create form skeleton */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Tags list skeleton */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
