"use client";

import { AlertTriangle } from "lucide-react";

interface QualityWarningProps {
  fileSizeBytes: number;
}

export function QualityWarning({ fileSizeBytes }: QualityWarningProps) {
  if (fileSizeBytes >= 500 * 1024) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">Low resolution image</p>
        <p className="text-xs mt-0.5">
          Small files may produce less accurate AI results. For best results,
          use a higher resolution photo.
        </p>
      </div>
    </div>
  );
}
