"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoViewer } from "./photo-viewer";
import { AttendanceList } from "./attendance-list";
import { ConfidenceBadge } from "./confidence-badge";
import { QuickEnrollDialog } from "./quick-enroll-dialog";
import { ArrowLeft, Loader2, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceType } from "@prisma/client";

interface AttendanceReviewPageProps {
  programId: string;
  sessionId: string;
  uploadId: string;
}

interface ExtractedRecord {
  id: string;
  uploadId: string;
  enrollmentId: string | null;
  attendanceType: AttendanceType | null;
  timeIn: string | null;
  timeOut: string | null;
  notes: string | null;
  confidence: number | null;
  needsReview: boolean;
  reviewFlag: string | null;
  isManuallyVerified: boolean;
  enrollment?: {
    id: string;
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
  } | null;
}

interface UploadData {
  id: string;
  status: string;
  aiConfidence: number | null;
  photoUrl?: string;
  enhancedPhotoUrl?: string;
  session?: {
    id: string;
    sessionNumber: number;
    title: string;
    date: string | null;
    program: { id: string; name: string };
  };
  extractedRecords?: ExtractedRecord[];
}

export function AttendanceReviewPage({
  programId,
  sessionId,
  uploadId,
}: AttendanceReviewPageProps) {
  const router = useRouter();
  const [upload, setUpload] = useState<UploadData | null>(null);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuickEnroll, setShowQuickEnroll] = useState(false);

  useEffect(() => {
    const fetchUpload = async () => {
      try {
        const response = await fetch(
          `/api/programs/${programId}/sessions/${sessionId}/attendance/${uploadId}?format=review`
        );
        if (!response.ok) throw new Error("Failed to load upload");
        const data = await response.json();
        setUpload(data.data);
        setRecords(data.data.extractedRecords || []);
      } catch (error) {
        console.error("Error loading review data:", error);
        toast.error("Failed to load review data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUpload();
  }, [programId, sessionId, uploadId]);

  const handleUpdateRecord = (
    index: number,
    updates: Partial<ExtractedRecord>
  ) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const reviewedRecords = records.map((r) => ({
        extractedRecordId: r.id,
        enrollmentId: r.enrollmentId,
        attendanceType: r.attendanceType || ("ABSENT" as AttendanceType),
        timeIn: r.timeIn,
        timeOut: r.timeOut,
        notes: r.notes,
      }));

      const response = await fetch(
        `/api/programs/${programId}/sessions/${sessionId}/attendance/${uploadId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: reviewedRecords, notes: reviewNotes }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Review submission failed");
      }

      toast.success("Attendance review submitted");
      router.push(`/programs/${programId}/sessions/${sessionId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit review"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickEnrolled = (enrollmentId: string, clientName: string) => {
    // Add the newly enrolled client as a record
    setRecords((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        uploadId,
        enrollmentId,
        attendanceType: "PRESENT" as AttendanceType,
        timeIn: null,
        timeOut: null,
        notes: null,
        confidence: null,
        needsReview: false,
        reviewFlag: null,
        isManuallyVerified: true,
        enrollment: {
          id: enrollmentId,
          client: {
            id: "",
            firstName: clientName.split(" ")[0] || clientName,
            lastName: clientName.split(" ").slice(1).join(" ") || "",
          },
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!upload) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Upload not found
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              router.push(`/programs/${programId}/sessions/${sessionId}`)
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Review Attendance</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {upload.session && (
                <span>
                  {upload.session.program.name} — Session{" "}
                  {upload.session.sessionNumber}: {upload.session.title}
                </span>
              )}
              {upload.aiConfidence != null && (
                <ConfidenceBadge confidence={upload.aiConfidence} />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowQuickEnroll(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Walk-in
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Review
          </Button>
        </div>
      </div>

      {/* Side-by-side layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Photo viewer */}
        <div className="lg:w-1/2">
          <PhotoViewer
            photoUrl={upload.photoUrl || ""}
            enhancedPhotoUrl={upload.enhancedPhotoUrl}
          />
        </div>

        {/* Records list */}
        <div className="lg:w-1/2 space-y-4">
          <AttendanceList
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onQuickEnroll={() => setShowQuickEnroll(true)}
            onAddManualEntry={() => setShowQuickEnroll(true)}
          />

          <div className="space-y-2">
            <Label htmlFor="review-notes">Review Notes</Label>
            <Textarea
              id="review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Optional notes about this review..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <QuickEnrollDialog
        programId={programId}
        sessionId={sessionId}
        open={showQuickEnroll}
        onOpenChange={setShowQuickEnroll}
        onEnrolled={handleQuickEnrolled}
      />
    </div>
  );
}
