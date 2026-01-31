"use client";

import { Suspense } from "react";
import { MassNotesWizard } from "@/components/mass-notes/mass-notes-wizard";
import { MassNotesBatchList } from "@/components/mass-notes/batch-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function MassNotesPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mass Notes</h1>
        <p className="text-muted-foreground">
          Create notes for multiple clients at once using templates with variable substitution.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create">Create Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
            <MassNotesWizard />
          </Suspense>
        </TabsContent>

        <TabsContent value="history">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
            <MassNotesBatchList />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
