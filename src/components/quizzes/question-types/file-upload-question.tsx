"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadQuestionProps {
  questionId: string;
  question: string;
  value?: { fileUrl: string; fileName: string };
  onChange: (value: { fileUrl: string; fileName: string } | undefined) => void;
  disabled?: boolean;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  showCorrect?: boolean;
  isCorrect?: boolean | null;
}

const DEFAULT_ALLOWED_TYPES = ["image/*", "application/pdf", ".doc", ".docx"];
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploadQuestion({
  questionId,
  question,
  value,
  onChange,
  disabled = false,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  showCorrect = false,
  isCorrect,
}: FileUploadQuestionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file size
    if (file.size > maxSizeBytes) {
      setError(`File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
      return;
    }

    // Upload file
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      onChange({
        fileUrl: data.url,
        fileName: file.name,
      });
    } catch (err) {
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const isImage = value?.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <div className="space-y-4">
      <Label htmlFor={questionId} className="text-base font-medium">
        {question}
      </Label>

      {value ? (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            {isImage ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.fileName}</p>
              <a
                href={value.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View file
              </a>
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isImage && (
            <img
              src={value.fileUrl}
              alt="Uploaded file preview"
              className="max-h-48 rounded object-contain"
            />
          )}
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            !disabled && "hover:border-primary cursor-pointer",
            disabled && "opacity-50"
          )}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium">
            {isUploading ? "Uploading..." : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Images and documents up to {Math.round(maxSizeBytes / 1024 / 1024)}MB
          </p>
        </div>
      )}

      <Input
        ref={inputRef}
        id={questionId}
        type="file"
        accept={allowedTypes.join(",")}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {showCorrect && isCorrect !== null && (
        <div
          className={`text-sm font-medium ${
            isCorrect ? "text-green-600" : "text-yellow-600"
          }`}
        >
          {isCorrect ? "File accepted" : "Pending review"}
        </div>
      )}
      {showCorrect && isCorrect === null && (
        <div className="text-sm text-muted-foreground">
          This upload requires manual review
        </div>
      )}
    </div>
  );
}
