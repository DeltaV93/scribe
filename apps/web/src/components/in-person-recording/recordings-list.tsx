"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mic,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Recording {
  id: string;
  createdAt: string;
  duration: number | null;
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  consentMethod: "DIGITAL" | "VERBAL" | "PRE_SIGNED";
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface RecordingsListProps {
  recordings: Recording[];
  isLoading?: boolean;
  onViewRecording?: (recordingId: string) => void;
  onPlayRecording?: (recordingId: string) => void;
  onProcessRecording?: (recordingId: string) => void;
  showClient?: boolean;
}

interface StatusConfigItem {
  label: string;
  icon: typeof Clock;
  variant: "secondary" | "default" | "destructive";
  animate?: boolean;
  className?: string;
}

const statusConfig: Record<string, StatusConfigItem> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    variant: "secondary",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    variant: "default",
    animate: true,
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    variant: "default",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
  },
  FAILED: {
    label: "Failed",
    icon: AlertCircle,
    variant: "destructive",
  },
};

const consentMethodLabels = {
  DIGITAL: "Digital Signature",
  VERBAL: "Verbal",
  PRE_SIGNED: "Pre-Signed",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecordingsList({
  recordings,
  isLoading,
  onViewRecording,
  onPlayRecording,
  onProcessRecording,
  showClient = true,
}: RecordingsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12 px-4 border rounded-lg bg-muted/50">
        <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No recordings yet</h3>
        <p className="text-sm text-muted-foreground">
          In-person recordings will appear here after they are created.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showClient && <TableHead>Client</TableHead>}
            <TableHead>Date</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Consent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recordings.map((recording) => {
            const status = statusConfig[recording.processingStatus];
            const StatusIcon = status.icon;

            return (
              <TableRow
                key={recording.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onViewRecording?.(recording.id)}
              >
                {showClient && (
                  <TableCell className="font-medium">
                    {recording.client.firstName} {recording.client.lastName}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span>
                      {formatDistanceToNow(new Date(recording.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(recording.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono">
                    {formatDuration(recording.duration)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {consentMethodLabels[recording.consentMethod]}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={status.variant}
                    className={cn(
                      "gap-1",
                      status.className
                    )}
                  >
                    <StatusIcon
                      className={cn(
                        "h-3 w-3",
                        status.animate && "animate-spin"
                      )}
                    />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {recording.user.name || recording.user.email.split("@")[0]}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewRecording?.(recording.id);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {recording.processingStatus === "COMPLETED" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayRecording?.(recording.id);
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Play Recording
                        </DropdownMenuItem>
                      )}
                      {recording.processingStatus === "PENDING" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onProcessRecording?.(recording.id);
                          }}
                        >
                          <Loader2 className="h-4 w-4 mr-2" />
                          Process Now
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
