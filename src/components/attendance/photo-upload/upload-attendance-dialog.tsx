"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "./image-preview";
import { QualityWarning } from "./quality-warning";
import { Camera, Loader2, Upload, Sparkles, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface UploadAttendanceDialogProps {
  programId: string;
  sessionId: string;
  onUploadComplete: (uploadId: string) => void;
}

type Step = "select" | "preview" | "uploading" | "processing" | "done";

export function UploadAttendanceDialog({
  programId,
  sessionId,
  onUploadComplete,
}: UploadAttendanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep("select");
    setFile(null);
    setUploadId(null);
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File must be less than 10MB");
      return;
    }
    setFile(selectedFile);
    setStep("preview");
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    []
  );

  const handleUpload = async () => {
    if (!file) return;
    setStep("uploading");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(
        `/api/programs/${programId}/sessions/${sessionId}/attendance/upload`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Upload failed");
      }

      const data = await response.json();
      setUploadId(data.data.uploadId);
      setStep("done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      setStep("preview");
    }
  };

  const handleProcessWithAI = async () => {
    if (!uploadId) return;
    setStep("processing");

    try {
      const response = await fetch(
        `/api/programs/${programId}/sessions/${sessionId}/attendance/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Processing failed");
      }

      toast.success("Processing complete");
      setOpen(false);
      onUploadComplete(uploadId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Processing failed");
      setStep("done");
    }
  };

  const handleManualEntry = () => {
    if (!uploadId) return;
    setOpen(false);
    onUploadComplete(uploadId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="mr-2 h-4 w-4" />
          Upload Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Attendance Photo</DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              Drop an image here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPEG, PNG, or WebP up to 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </div>
        )}

        {step === "preview" && file && (
          <div className="space-y-4">
            <ImagePreview
              file={file}
              onRemove={() => {
                setFile(null);
                setStep("select");
              }}
            />
            <QualityWarning fileSizeBytes={file.size} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setFile(null); setStep("select"); }}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Uploading photo...</p>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">
              AI is processing the attendance sheet...
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Photo uploaded successfully. How would you like to proceed?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleProcessWithAI}>
                <Sparkles className="mr-2 h-4 w-4" />
                Process with AI
              </Button>
              <Button variant="outline" onClick={handleManualEntry}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Enter Manually
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
