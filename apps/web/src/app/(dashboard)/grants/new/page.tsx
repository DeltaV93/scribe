"use client";

import { GrantForm } from "@/components/grants/grant-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewGrantPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/grants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Grant</h1>
          <p className="text-muted-foreground">
            Create a new grant to track deliverables and progress.
          </p>
        </div>
      </div>

      {/* Form */}
      <GrantForm mode="create" />
    </div>
  );
}
