"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  File,
  X,
  Loader2,
  FileImage,
  FileText,
  AlertCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  formName: string
  clientId?: string
  onUploadComplete: (extractionId: string) => void
}

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error"

export function DocumentUploadDialog({
  open,
  onOpenChange,
  formId,
  formName,
  clientId,
  onUploadComplete,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
    },
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024, // 25MB
    disabled: uploadState !== "idle",
  })

  const handleUpload = async () => {
    if (!file) return

    setUploadState("uploading")
    setProgress(10)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("formId", formId)
      if (clientId) {
        formData.append("clientId", clientId)
      }

      setProgress(30)

      const response = await fetch("/api/document-extraction", {
        method: "POST",
        body: formData,
      })

      setProgress(60)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      setUploadState("processing")
      setProgress(80)

      const data = await response.json()

      setProgress(100)
      setUploadState("complete")

      // Small delay for UX
      setTimeout(() => {
        onUploadComplete(data.extractionId)
        handleClose()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setUploadState("error")
    }
  }

  const handleClose = () => {
    setFile(null)
    setUploadState("idle")
    setProgress(0)
    setError(null)
    onOpenChange(false)
  }

  const removeFile = () => {
    setFile(null)
    setError(null)
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />
    }
    return <FileImage className="h-8 w-8 text-blue-500" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document for Extraction</DialogTitle>
          <DialogDescription>
            Upload a photo or PDF to automatically extract data for{" "}
            <span className="font-medium">{formName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dropzone */}
          {!file && uploadState === "idle" && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-sm text-primary">Drop the file here...</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPEG, PNG, WebP, or HEIC - Max 25MB
                  </p>
                </>
              )}
            </div>
          )}

          {/* File preview */}
          {file && uploadState === "idle" && (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeFile}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload progress */}
          {(uploadState === "uploading" || uploadState === "processing") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {uploadState === "uploading"
                      ? "Uploading document..."
                      : "Extracting data..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadState === "processing" &&
                      "AI is analyzing your document"}
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Upload failed
                </p>
                <p className="text-xs text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {/* Tips */}
          {uploadState === "idle" && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Tips for best results:
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-0.5">
                <li>- Ensure document is clearly visible and well-lit</li>
                <li>- Handwritten text should be legible</li>
                <li>- Avoid blurry or rotated images</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {file && uploadState === "idle" && (
            <Button onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Extract Data
            </Button>
          )}
          {uploadState === "error" && (
            <Button onClick={handleUpload}>Try Again</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
