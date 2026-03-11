"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceStatusBadge } from "./attendance-status-badge";
import { GenerateSheetDialog } from "./sheet-generation";
import { UploadAttendanceDialog } from "./photo-upload/upload-attendance-dialog";
import { ManualEntryForm } from "./review/manual-entry-form";
import {
  Camera,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Users,
  UserCheck,
  UserMinus,
  UserX,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import type { AttendanceType } from "@prisma/client";

interface SessionAttendanceTabProps {
  programId: string;
  sessionId: string;
  programName: string;
  sessionTitle: string;
  sessionNumber: number;
  sessionDate: string | null;
  durationMinutes: number | null;
}

interface AttendanceSummary {
  totalEnrolled: number;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  notRecordedCount: number;
  attendanceRate: number;
  totalHours: number;
}

interface AttendanceRecord {
  enrollmentId: string;
  clientName: string;
  attendanceType: AttendanceType | null;
  hoursAttended: number | null;
  timeIn: string | null;
  timeOut: string | null;
  signatureVerified: boolean;
  notes: string | null;
  uploadSourceId: string | null;
}

interface Upload {
  id: string;
  status: string;
  createdAt: string;
  photoUploadedAt: string | null;
  aiConfidence: number | null;
  reviewedAt: string | null;
}

export function SessionAttendanceTab({
  programId,
  sessionId,
  programName,
  sessionTitle,
  sessionNumber,
  sessionDate,
  durationMinutes,
}: SessionAttendanceTabProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [attendanceRes, reportRes] = await Promise.all([
        fetch(`/api/programs/${programId}/sessions/${sessionId}/attendance`),
        fetch(`/api/attendance/reports/session/${sessionId}`),
      ]);

      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        setRecords(data.data?.records || []);
        setSummary(data.data?.summary || null);
      }

      if (reportRes.ok) {
        const data = await reportRes.json();
        if (data.data?.summary) {
          setSummary(data.data.summary);
        }
        if (data.data?.records) {
          setRecords(data.data.records);
        }
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
    }
  }, [programId, sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SHEET_GENERATED: "Sheet Generated",
      PHOTO_UPLOADED: "Photo Uploaded",
      AI_PROCESSING: "Processing",
      AI_COMPLETE: "Ready for Review",
      PENDING_REVIEW: "Pending Review",
      CONFIRMED: "Confirmed",
      FAILED: "Failed",
      PENDING_OVERRIDE_REVIEW: "Override Pending",
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (showManualEntry) {
    return (
      <ManualEntryForm
        programId={programId}
        sessionId={sessionId}
        onComplete={() => {
          setShowManualEntry(false);
          fetchData();
        }}
      />
    );
  }

  const statCards = [
    { label: "Present", count: summary?.presentCount ?? 0, icon: UserCheck, color: "text-green-600" },
    { label: "Excused", count: summary?.excusedCount ?? 0, icon: UserMinus, color: "text-yellow-600" },
    { label: "Absent", count: summary?.absentCount ?? 0, icon: UserX, color: "text-red-600" },
    { label: "Not Recorded", count: summary?.notRecordedCount ?? 0, icon: Users, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <UploadAttendanceDialog
          programId={programId}
          sessionId={sessionId}
          onUploadComplete={(uploadId) => {
            router.push(`/programs/${programId}/sessions/${sessionId}/attendance/review?uploadId=${uploadId}`);
          }}
        />
        <Button variant="outline" onClick={() => setShowManualEntry(true)}>
          <ClipboardList className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
        <GenerateSheetDialog
          programId={programId}
          programName={programName}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          sessionNumber={sessionNumber}
          sessionDate={sessionDate ? new Date(sessionDate) : null}
        />
      </div>

      {/* Uploads List */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div className="flex items-center gap-3">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {upload.photoUploadedAt
                          ? format(new Date(upload.photoUploadedAt), "MMM d, yyyy h:mm a")
                          : format(new Date(upload.createdAt), "MMM d, yyyy")}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {statusLabel(upload.status)}
                      </Badge>
                    </div>
                  </div>
                  {(upload.status === "AI_COMPLETE" || upload.status === "PENDING_REVIEW") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/programs/${programId}/sessions/${sessionId}/attendance/review?uploadId=${upload.id}`
                        )
                      }
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Review
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Attendance Records ({records.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No attendance recorded yet</p>
              <p className="text-sm mt-1">
                Upload a photo or enter attendance manually
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.enrollmentId}>
                    <TableCell className="font-medium">
                      {record.clientName}
                    </TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={record.attendanceType} />
                    </TableCell>
                    <TableCell>
                      {record.hoursAttended != null
                        ? `${record.hoursAttended}h`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {record.timeIn
                        ? format(new Date(record.timeIn), "h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {record.timeOut
                        ? format(new Date(record.timeOut), "h:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
