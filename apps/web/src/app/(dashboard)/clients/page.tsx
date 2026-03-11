"use client";

import { Suspense } from "react";
import { ClientList } from "@/components/clients/client-list";
import { Loader2 } from "lucide-react";

export default function ClientsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Manage client records and their submitted forms.
        </p>
      </div>

      {/* Clients List */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <ClientList />
      </Suspense>
    </div>
  );
}
