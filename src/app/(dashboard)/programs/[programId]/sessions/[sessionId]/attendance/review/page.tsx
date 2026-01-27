"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AttendanceReviewPage } from "@/components/attendance/review/attendance-review-page";

export default function ReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const programId = params.programId as string;
  const sessionId = params.sessionId as string;
  const uploadId = searchParams.get("uploadId");

  if (!uploadId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No upload specified. Please select an upload to review.</p>
      </div>
    );
  }

  return (
    <AttendanceReviewPage
      programId={programId}
      sessionId={sessionId}
      uploadId={uploadId}
    />
  );
}
