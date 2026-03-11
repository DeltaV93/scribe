import type { AttendanceUploadStatus, AttendanceType } from "@prisma/client";

// ============================================
// ATTENDANCE CODE TYPES
// ============================================

export interface AttendanceCodeInfo {
  id: string;
  enrollmentId: string;
  code: string;
  clientName: string;
  createdAt: Date;
}

export interface GenerateCodesInput {
  programId: string;
  enrollmentIds?: string[]; // If not provided, generate for all active enrollments
}

export interface GenerateCodesResult {
  generated: AttendanceCodeInfo[];
  skipped: { enrollmentId: string; reason: string }[];
}

// ============================================
// ATTENDANCE SHEET CONFIG TYPES
// ============================================

export interface AttendanceSheetConfigInput {
  programId: string;
  includeTimeInOut?: boolean;
  includeClientSignature?: boolean;
  includeNotes?: boolean;
  customInstructions?: string | null;
}

export interface AttendanceSheetConfig {
  id: string;
  programId: string;
  includeTimeInOut: boolean;
  includeClientSignature: boolean;
  includeNotes: boolean;
  customInstructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ATTENDANCE SHEET GENERATION TYPES
// ============================================

export interface GenerateSheetInput {
  sessionId: string;
  date?: Date; // Override date (defaults to session date or current date)
  userId: string;
}

export interface GenerateSheetResult {
  uploadId: string;
  pdfBuffer: Buffer;
  fileName: string;
  s3Key?: string; // If stored to S3
}

export interface BatchGenerateSheetInput {
  programId: string;
  startDate: Date;
  endDate: Date;
  userId: string;
}

export interface BatchGenerateSheetResult {
  generated: {
    sessionId: string;
    sessionNumber: number;
    uploadId: string;
    fileName: string;
    s3Key?: string;
  }[];
  failed: {
    sessionId: string;
    sessionNumber: number;
    error: string;
  }[];
}

// ============================================
// SHEET DATA FOR PDF GENERATION
// ============================================

export interface AttendanceSheetData {
  program: {
    id: string;
    name: string;
    labelType: string;
  };
  session: {
    id: string;
    sessionNumber: number;
    title: string;
    date: Date | null;
    durationMinutes: number | null;
  };
  config: {
    includeTimeInOut: boolean;
    includeClientSignature: boolean;
    includeNotes: boolean;
    customInstructions: string | null;
  };
  enrollments: AttendanceSheetEnrollment[];
  generatedAt: Date;
}

export interface AttendanceSheetEnrollment {
  enrollmentId: string;
  clientName: string;
  attendanceCode: string;
  qrCodeDataUrl: string; // Base64 data URL for QR code
}

// ============================================
// ATTENDANCE UPLOAD TYPES
// ============================================

export interface AttendanceUploadInfo {
  id: string;
  sessionId: string;
  orgId: string;
  status: AttendanceUploadStatus;
  sheetPath: string | null;
  sheetGeneratedAt: Date | null;
  photoPath: string | null;
  photoUploadedAt: Date | null;
  photoMimeType: string | null;
  photoSizeBytes: number | null;
  enhancedPhotoPath: string | null;
  aiProcessingStartedAt: Date | null;
  aiProcessingEndedAt: Date | null;
  aiConfidence: number | null;
  aiError: string | null;
  aiRetryCount: number;
  reviewedAt: Date | null;
  reviewedById: string | null;
  reviewNotes: string | null;
  isOverride: boolean;
  overrideReason: string | null;
  overrideApprovedById: string | null;
  overrideApprovedAt: Date | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  session?: {
    id: string;
    sessionNumber: number;
    title: string;
    date: Date | null;
    program: {
      id: string;
      name: string;
    };
  };
  extractedRecords?: AttendanceExtractedRecordInfo[];
}

export interface AttendanceExtractedRecordInfo {
  id: string;
  uploadId: string;
  enrollmentId: string | null;
  attendanceType: AttendanceType | null;
  qrCodeDetected: boolean;
  qrCodeValue: string | null;
  printedCodeDetected: boolean;
  printedCodeValue: string | null;
  timeIn: Date | null;
  timeOut: Date | null;
  signatureDetected: boolean;
  notes: string | null;
  confidence: number | null;
  needsReview: boolean;
  reviewFlag: string | null;
  isManuallyVerified: boolean;
  manuallyVerifiedById: string | null;
  manuallyVerifiedAt: Date | null;
  enrollment?: {
    id: string;
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
  } | null;
}

// ============================================
// AI RECOGNITION TYPES
// ============================================

export interface AIExtractionInput {
  uploadId: string;
  photoPath: string;
  sessionContext: {
    programName: string;
    sessionTitle: string;
    sessionDate: Date | null;
    expectedEnrollments: {
      enrollmentId: string;
      clientName: string;
      attendanceCode: string;
    }[];
    config: {
      includeTimeInOut: boolean;
      includeClientSignature: boolean;
      includeNotes: boolean;
    };
  };
}

export interface AIExtractionResult {
  success: boolean;
  records: AIExtractedRecord[];
  overallConfidence: number;
  processingTimeMs: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
}

export interface AIExtractedRecord {
  rowIndex: number;
  qrCodeDetected: boolean;
  qrCodeValue: string | null;
  printedCodeDetected: boolean;
  printedCodeValue: string | null;
  matchedEnrollmentId: string | null;
  matchConfidence: number;
  attendanceType: AttendanceType | null;
  timeIn: string | null; // ISO string
  timeOut: string | null; // ISO string
  signatureDetected: boolean;
  notes: string | null;
  confidence: number;
  needsReview: boolean;
  reviewFlags: string[];
}

// ============================================
// REVIEW WORKFLOW TYPES
// ============================================

export interface ReviewAttendanceInput {
  uploadId: string;
  reviewerId: string;
  records: ReviewedRecord[];
  notes?: string;
}

export interface ReviewedRecord {
  extractedRecordId: string;
  enrollmentId: string | null; // Can change if walk-in enrolled
  attendanceType: AttendanceType;
  timeIn?: Date | null;
  timeOut?: Date | null;
  hoursAttended?: number | null;
  notes?: string | null;
}

export interface ReviewAttendanceResult {
  success: boolean;
  attendanceRecordsCreated: number;
  attendanceRecordsUpdated: number;
  errors: { recordId: string; error: string }[];
}

// ============================================
// RATE LIMITING TYPES
// ============================================

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  windowResetAt: Date;
}

// ============================================
// REPORT TYPES
// ============================================

export interface ClientAttendanceReport {
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  programs: {
    programId: string;
    programName: string;
    enrollmentId: string;
    enrollmentStatus: string;
    requiredHours: number | null;
    hoursCompleted: number;
    hoursRemaining: number | null;
    attendanceRate: number;
    sessions: {
      sessionId: string;
      sessionNumber: number;
      sessionTitle: string;
      sessionDate: Date | null;
      attendanceType: AttendanceType | null;
      hoursAttended: number | null;
      notes: string | null;
    }[];
  }[];
}

export interface SessionAttendanceReport {
  session: {
    id: string;
    sessionNumber: number;
    title: string;
    date: Date | null;
    durationMinutes: number | null;
  };
  program: {
    id: string;
    name: string;
  };
  summary: {
    totalEnrolled: number;
    presentCount: number;
    excusedCount: number;
    absentCount: number;
    notRecordedCount: number;
    attendanceRate: number;
    totalHours: number;
  };
  records: {
    enrollmentId: string;
    clientName: string;
    attendanceType: AttendanceType | null;
    hoursAttended: number | null;
    timeIn: Date | null;
    timeOut: Date | null;
    signatureVerified: boolean;
    notes: string | null;
    uploadSourceId: string | null;
  }[];
}

export interface ProgramAttendanceReport {
  program: {
    id: string;
    name: string;
    requiredHours: number | null;
    startDate: Date | null;
    endDate: Date | null;
  };
  summary: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    totalSessions: number;
    sessionsWithAttendance: number;
    overallAttendanceRate: number;
    totalHoursRecorded: number;
    averageHoursPerEnrollment: number;
  };
  sessionSummaries: {
    sessionId: string;
    sessionNumber: number;
    sessionTitle: string;
    sessionDate: Date | null;
    presentCount: number;
    excusedCount: number;
    absentCount: number;
    attendanceRate: number;
  }[];
  enrollmentSummaries: {
    enrollmentId: string;
    clientName: string;
    status: string;
    sessionsAttended: number;
    totalSessions: number;
    attendanceRate: number;
    hoursCompleted: number;
    hoursRemaining: number | null;
  }[];
}
