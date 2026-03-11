"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "./confidence-badge";
import { UserPlus } from "lucide-react";
import type { AttendanceType } from "@prisma/client";

interface ExtractedRecord {
  id: string;
  enrollmentId: string | null;
  attendanceType: AttendanceType | null;
  timeIn: string | null;
  timeOut: string | null;
  notes: string | null;
  confidence: number | null;
  needsReview: boolean;
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

interface AttendanceListProps {
  records: ExtractedRecord[];
  onUpdateRecord: (index: number, updates: Partial<ExtractedRecord>) => void;
  onQuickEnroll: () => void;
  onAddManualEntry: () => void;
}

export function AttendanceList({
  records,
  onUpdateRecord,
  onQuickEnroll,
}: AttendanceListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Records ({records.length})
        </h3>
        <Button variant="outline" size="sm" onClick={onQuickEnroll}>
          <UserPlus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
        {records.map((record, index) => {
          const clientName = record.enrollment
            ? `${record.enrollment.client.firstName} ${record.enrollment.client.lastName}`
            : "Unmatched";

          return (
            <div
              key={record.id}
              className={`rounded-md border p-3 space-y-2 ${
                record.needsReview
                  ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{clientName}</span>
                  {!record.enrollmentId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={onQuickEnroll}
                    >
                      <UserPlus className="mr-1 h-3 w-3" />
                      Enroll
                    </Button>
                  )}
                </div>
                <ConfidenceBadge confidence={record.confidence} />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={record.attendanceType || ""}
                  onValueChange={(val) =>
                    onUpdateRecord(index, {
                      attendanceType: val as AttendanceType,
                    })
                  }
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="time"
                  className="w-[110px] h-8 text-xs"
                  placeholder="Time in"
                  value={record.timeIn ? record.timeIn.slice(11, 16) : ""}
                  onChange={(e) =>
                    onUpdateRecord(index, {
                      timeIn: e.target.value
                        ? `1970-01-01T${e.target.value}:00.000Z`
                        : null,
                    })
                  }
                />
                <Input
                  type="time"
                  className="w-[110px] h-8 text-xs"
                  placeholder="Time out"
                  value={record.timeOut ? record.timeOut.slice(11, 16) : ""}
                  onChange={(e) =>
                    onUpdateRecord(index, {
                      timeOut: e.target.value
                        ? `1970-01-01T${e.target.value}:00.000Z`
                        : null,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="Notes"
                  value={record.notes || ""}
                  onChange={(e) =>
                    onUpdateRecord(index, { notes: e.target.value || null })
                  }
                />
                <div className="flex items-center gap-1">
                  <Checkbox
                    id={`verify-${record.id}`}
                    checked={record.isManuallyVerified}
                    onCheckedChange={(checked) =>
                      onUpdateRecord(index, {
                        isManuallyVerified: checked === true,
                      })
                    }
                  />
                  <label
                    htmlFor={`verify-${record.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Verified
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
