"use client";

/**
 * File Uploader Component for Imports
 *
 * Drag-and-drop file upload with CSV/Excel/JSON support.
 */

import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileSpreadsheet, File, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImportFileUploaderProps {
  onFileSelected: (file: File) => void;
  onUploadComplete?: (result: UploadResult) => void;
  isUploading?: boolean;
  className?: string;
  disabled?: boolean;
}

export interface UploadResult {
  batchId: string;
  fileName: string;
  totalRows: number;
  columns: string[];
  preview: Record<string, unknown>[];
  suggestedMappings: Array<{
    sourceColumn: string;
    targetField: string;
    confidence?: number;
    aiSuggested?: boolean;
  }>;
}

const ACCEPTED_FILE_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/json": [".json"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ImportFileUploader({
  onFileSelected,
  isUploading = false,
  className,
  disabled = false,
}: ImportFileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null);

      if (fileRejections.length > 0) {
        const firstError = fileRejections[0].errors[0];
        setError(firstError.message);
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        if (file.size > MAX_FILE_SIZE) {
          setError("File size exceeds 10MB limit");
          return;
        }

        setSelectedFile(file);
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "csv" || ext === "xlsx" || ext === "xls") {
      return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
    }
    return <File className="h-8 w-8 text-blue-600" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
            (disabled || isUploading) && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium">Uploading and analyzing file...</p>
            </div>
          ) : isDragActive ? (
            <div className="flex flex-col items-center">
              <Upload className="h-10 w-10 text-primary mb-4" />
              <p className="text-sm font-medium text-primary">Drop your file here</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Drag & drop your file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">
                Supported formats: CSV, Excel (.xlsx, .xls), JSON
              </p>
              <p className="text-xs text-muted-foreground">Maximum size: 10MB</p>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getFileIcon(selectedFile.name)}
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {isUploading && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
