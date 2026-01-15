"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, CheckCircle, AlertCircle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/files/types";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "scanning" | "complete" | "error";
  progress: number;
  error?: string;
  scanStatus?: string;
}

interface FileUploaderProps {
  onUploadComplete?: (file: { id: string; name: string }) => void;
  maxFiles?: number;
  className?: string;
}

export function FileUploader({
  onUploadComplete,
  maxFiles = 10,
  className,
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const uploadFile = async (file: File): Promise<void> => {
    const tempId = crypto.randomUUID();

    // Add file to state
    setFiles((prev) => [
      ...prev,
      {
        id: tempId,
        name: file.name,
        size: file.size,
        status: "uploading",
        progress: 0,
      },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload the file
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();

      // Update file status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                id: result.file.id,
                status: result.file.scanStatus === "PENDING" ? "scanning" : "complete",
                progress: 100,
                scanStatus: result.file.scanStatus,
              }
            : f
        )
      );

      // If scan is pending, poll for status
      if (result.file.scanStatus === "PENDING" || result.file.scanStatus === "SCANNING") {
        pollScanStatus(result.file.id, tempId);
      } else {
        onUploadComplete?.({ id: result.file.id, name: file.name });
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const pollScanStatus = async (fileId: string, tempId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/files/${fileId}`);
        if (!response.ok) return;

        const result = await response.json();
        const scanStatus = result.file.scanStatus;

        if (scanStatus === "CLEAN") {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId || f.id === tempId
                ? { ...f, id: fileId, status: "complete", scanStatus }
                : f
            )
          );
          onUploadComplete?.({ id: fileId, name: result.file.originalName });
        } else if (scanStatus === "INFECTED" || scanStatus === "ERROR") {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId || f.id === tempId
                ? {
                    ...f,
                    id: fileId,
                    status: "error",
                    error: scanStatus === "INFECTED" ? "File failed security scan" : "Scan error",
                    scanStatus,
                  }
                : f
            )
          );
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch {
        // Ignore polling errors
      }
    };

    poll();
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remainingSlots = maxFiles - files.length;
      const filesToUpload = acceptedFiles.slice(0, remainingSlots);

      filesToUpload.forEach((file) => {
        uploadFile(file);
      });
    },
    [files.length, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
    },
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getStatusIcon = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "scanning":
        return <Shield className="h-4 w-4 animate-pulse text-yellow-500" />;
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
        return "Uploading...";
      case "scanning":
        return "Scanning for threats...";
      case "complete":
        return "Ready";
      case "error":
        return file.error || "Error";
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm text-primary">Drop files here...</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word, Images, Audio, Text • Max 100MB per file
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                file.status === "error" && "border-red-200 bg-red-50",
                file.status === "complete" && "border-green-200 bg-green-50"
              )}
            >
              <File className="h-8 w-8 text-muted-foreground shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(file)}
                    {getStatusText(file)}
                  </span>
                </div>
                {file.status === "uploading" && (
                  <Progress value={file.progress} className="h-1 mt-2" />
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeFile(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
