"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { UploadDialog } from "@/components/form-conversion/upload-dialog";

interface FormsHeaderActionsProps {
  canCreateForms: boolean;
}

export function FormsHeaderActions({ canCreateForms }: FormsHeaderActionsProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  if (!canCreateForms) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Convert from PDF
      </Button>
      <Link href="/forms/new">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Form
        </Button>
      </Link>

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />
    </div>
  );
}
