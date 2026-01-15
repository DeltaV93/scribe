// File upload types
export interface FileUploadResult {
  id: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: ScanStatus;
  uploadedAt: Date;
}

export type ScanStatus = "PENDING" | "SCANNING" | "CLEAN" | "INFECTED" | "ERROR";

export interface ScanResult {
  status: ScanStatus;
  threats?: string[];
  scannedAt: Date;
  scannerVersion?: string;
  error?: string;
}

export interface TextExtractionResult {
  success: boolean;
  text?: string;
  pageCount?: number;
  metadata?: Record<string, string>;
  error?: string;
}

// Allowed file types and their configurations
export interface FileTypeConfig {
  mimeTypes: string[];
  extensions: string[];
  maxSizeBytes: number;
  extractText: boolean;
  category: "document" | "image" | "audio" | "other";
}

export const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  pdf: {
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    extractText: true,
    category: "document",
  },
  word: {
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    extensions: [".doc", ".docx"],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    extractText: true,
    category: "document",
  },
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    extractText: false,
    category: "image",
  },
  audio: {
    mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
    extensions: [".mp3", ".wav", ".ogg", ".webm"],
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    extractText: false,
    category: "audio",
  },
  text: {
    mimeTypes: ["text/plain", "text/csv"],
    extensions: [".txt", ".csv"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    extractText: true,
    category: "document",
  },
};

// Get all allowed MIME types
export function getAllowedMimeTypes(): string[] {
  return Object.values(FILE_TYPE_CONFIGS).flatMap((c) => c.mimeTypes);
}

// Get all allowed extensions
export function getAllowedExtensions(): string[] {
  return Object.values(FILE_TYPE_CONFIGS).flatMap((c) => c.extensions);
}

// Get max file size across all types
export function getMaxFileSize(): number {
  return Math.max(...Object.values(FILE_TYPE_CONFIGS).map((c) => c.maxSizeBytes));
}

// Validate file type
export function validateFileType(
  mimeType: string,
  fileName: string
): { valid: boolean; config?: FileTypeConfig; error?: string } {
  const extension = "." + fileName.split(".").pop()?.toLowerCase();

  for (const config of Object.values(FILE_TYPE_CONFIGS)) {
    if (
      config.mimeTypes.includes(mimeType) ||
      config.extensions.includes(extension)
    ) {
      return { valid: true, config };
    }
  }

  return {
    valid: false,
    error: `File type not allowed. Allowed types: ${getAllowedExtensions().join(", ")}`,
  };
}

// Validate file size
export function validateFileSize(
  sizeBytes: number,
  config: FileTypeConfig
): { valid: boolean; error?: string } {
  if (sizeBytes > config.maxSizeBytes) {
    const maxMB = Math.round(config.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxMB}MB`,
    };
  }
  return { valid: true };
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
