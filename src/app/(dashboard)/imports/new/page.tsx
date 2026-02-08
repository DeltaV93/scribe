"use client";

/**
 * New Import Page
 *
 * Multi-step wizard for importing client data.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/components/imports";

export default function NewImportPage() {
  const router = useRouter();

  const handleComplete = (result: { batchId: string }) => {
    // Navigate to the import detail page
    router.push(`/imports/${result.batchId}`);
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-6">
        <Link href="/imports">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Import Center
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Import Client Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV, Excel, or JSON file to import client records into Scrybe.
        </p>
      </div>

      <ImportWizard
        entityType="CLIENT"
        onComplete={handleComplete}
      />
    </div>
  );
}
