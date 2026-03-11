"use client";

import { Suspense } from "react";
import { GrantList } from "@/components/grants/grant-list";
import { Loader2 } from "lucide-react";

export default function GrantsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grants</h1>
        <p className="text-muted-foreground">
          Track grant deliverables, progress, and reporting deadlines.
        </p>
      </div>

      {/* Grants List */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <GrantList />
      </Suspense>
    </div>
  );
}
