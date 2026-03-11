"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Eye } from "lucide-react";

interface Override {
  id: string;
  sessionId: string;
  status: string;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
  session: {
    id: string;
    sessionNumber: number;
    title: string;
    date: string | null;
    program: { id: string; name: string };
  };
  uploadedBy: { id: string; name: string | null; email: string };
}

interface PendingOverridesListProps {
  overrides: Override[];
  onAction: (override: Override) => void;
}

export function PendingOverridesList({
  overrides,
  onAction,
}: PendingOverridesListProps) {
  if (overrides.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        No pending override requests
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Program</TableHead>
          <TableHead>Session</TableHead>
          <TableHead>Requested By</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-20">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overrides.map((override) => (
          <TableRow key={override.id}>
            <TableCell className="font-medium">
              {override.session.program.name}
            </TableCell>
            <TableCell>
              Session {override.session.sessionNumber}: {override.session.title}
            </TableCell>
            <TableCell>
              {override.uploadedBy.name || override.uploadedBy.email}
            </TableCell>
            <TableCell className="max-w-[200px] truncate">
              {override.overrideReason || "-"}
            </TableCell>
            <TableCell>
              {format(new Date(override.updatedAt), "MMM d, yyyy")}
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction(override)}
              >
                <Eye className="mr-1 h-3 w-3" />
                Review
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
