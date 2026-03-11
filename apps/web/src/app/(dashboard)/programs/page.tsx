"use client";

import { Suspense } from "react";
import { ProgramList } from "@/components/programs/program-list";
import { Loader2 } from "lucide-react";

export default function ProgramsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
        <p className="text-muted-foreground">
          Manage educational programs, courses, and track client participation.
        </p>
      </div>

      {/* Programs List */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <ProgramList />
      </Suspense>
    </div>
  );
}
