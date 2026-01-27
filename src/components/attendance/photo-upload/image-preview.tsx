"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImagePreviewProps {
  file: File | null;
  url?: string;
  onRemove: () => void;
}

export function ImagePreview({ file, url, onRemove }: ImagePreviewProps) {
  const previewUrl = useMemo(() => {
    if (url) return url;
    if (file) return URL.createObjectURL(file);
    return null;
  }, [file, url]);

  if (!previewUrl) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative rounded-lg border overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Attendance photo preview"
        className="w-full max-h-64 object-contain bg-muted"
      />
      <div className="flex items-center justify-between p-2 bg-muted/50">
        <div className="text-xs text-muted-foreground">
          {file && (
            <>
              <span className="font-medium">{file.name}</span>
              <span className="ml-2">{formatSize(file.size)}</span>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
