"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

const ACCEPTED_FILES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversionId, setConversionId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles.length > 0) {
      setError("Invalid file type. Please upload a JPEG, PNG, WebP, or PDF file.");
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];

      if (selectedFile.size > MAX_FILE_SIZE) {
        setError("File is too large. Maximum size is 25MB.");
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  const handleUpload = async () => {
    if (!file) return;

    setState("uploading");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/form-conversion/upload", {
        method: "POST",
        body: formData,
      });

      setProgress(50);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Upload failed");
      }

      const data = await response.json();
      setConversionId(data.data.conversionId);
      setProgress(70);

      // Check if processing was done synchronously (no job queue)
      if (data.data.processed || !data.data.jobId) {
        // Processing was done synchronously
        setProgress(100);

        if (data.data.status === "FAILED") {
          setState("error");
          setError(data.data.warnings?.[0] || "Processing failed");
          toast.error("Processing failed");
        } else {
          setState("success");
          toast.success("Document processed successfully");
        }
        return;
      }

      setState("processing");

      // Poll for completion
      await pollForCompletion(data.data.jobId);
    } catch (err) {
      setState("error");
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Provide more specific error messages
      if (errorMessage.includes("not enabled")) {
        toast.error("This feature is not enabled for your organization");
      } else if (errorMessage.includes("S3") || errorMessage.includes("upload")) {
        toast.error("Failed to upload file. Please try again.");
      } else {
        toast.error("Upload failed. Please try again.");
      }
    }
  };

  const pollForCompletion = async (jobId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    let pendingCount = 0;
    const maxPendingAttempts = 15; // If job is PENDING for 30 seconds, trigger manual processing

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          // Handle non-JSON responses
          const text = await response.text();
          console.error(`Job poll failed: ${response.status} - ${text}`);
          continue;
        }

        const data = await response.json();
        const job = data.data;

        if (!job) {
          console.error("No job data in response");
          continue;
        }

        setProgress(70 + Math.min(job.progress || 0, 100) * 0.25);

        if (job.status === "COMPLETED") {
          setState("success");
          setProgress(100);
          toast.success("Document processed successfully");
          return;
        }

        if (job.status === "FAILED") {
          throw new Error(job.error || "Processing failed");
        }

        // Check if job is stuck in PENDING
        if (job.status === "PENDING") {
          pendingCount++;

          // If stuck in PENDING, try to trigger processing manually
          if (pendingCount === maxPendingAttempts && conversionId) {
            console.log("Job stuck in PENDING, attempting direct status check");

            // Check conversion status directly
            const conversionResponse = await fetch(`/api/form-conversion/${conversionId}`);
            if (conversionResponse.ok) {
              const conversionData = await conversionResponse.json();
              const conversion = conversionData.data;

              if (conversion?.status === "REVIEW_REQUIRED" || conversion?.status === "COMPLETED") {
                setState("success");
                setProgress(100);
                toast.success("Document processed successfully");
                return;
              }

              if (conversion?.status === "FAILED") {
                throw new Error(conversion.warnings?.[0] || "Processing failed");
              }
            }
          }

          if (pendingCount >= maxPendingAttempts * 2) {
            // Job is stuck, likely no worker running
            throw new Error(
              "Processing is taking longer than expected. The document has been queued for processing. Please check back later."
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && !err.message.includes("longer than expected")) {
          // Only throw immediately for definitive errors
          if (err.message.includes("failed") || attempts >= maxAttempts) {
            throw err;
          }
        } else if (attempts >= maxAttempts) {
          throw new Error("Processing timed out. Please try again later.");
        } else {
          throw err;
        }
      }
    }

    throw new Error("Processing timed out. Please try again later.");
  };

  const handleViewResults = () => {
    if (conversionId) {
      router.push(`/forms/convert/${conversionId}/review`);
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setState("idle");
    setFile(null);
    setError(null);
    setProgress(0);
    setConversionId(null);
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="h-12 w-12 text-muted-foreground" />;

    if (file.type === "application/pdf") {
      return <FileText className="h-12 w-12 text-red-500" />;
    }

    return <Image className="h-12 w-12 text-blue-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert Document to Form</DialogTitle>
          <DialogDescription>
            Upload a photo or PDF of a paper form to automatically create a digital form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {state === "idle" && (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  {getFileIcon()}
                  {file ? (
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">
                        {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to select a file
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline">JPEG</Badge>
                <Badge variant="outline">PNG</Badge>
                <Badge variant="outline">WebP</Badge>
                <Badge variant="outline">PDF</Badge>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!file}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </Button>
              </div>
            </>
          )}

          {(state === "uploading" || state === "processing") && (
            <div className="space-y-4 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <div>
                <p className="font-medium">
                  {state === "uploading" ? "Uploading..." : "Processing document..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {state === "processing" && "Detecting form fields with AI"}
                </p>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {state === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <div>
                <p className="font-medium">Document processed successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Review the detected fields before creating your form.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Upload Another
                </Button>
                <Button onClick={handleViewResults}>
                  Review Fields
                </Button>
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <p className="font-medium">Processing failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={handleReset}>Try Again</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
