"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CallStatusBadge } from "@/components/calls/call-status-badge";
import { CallDurationDisplay } from "@/components/calls/call-timer";
import { CallStatus } from "@prisma/client";
import { Loader2, Phone } from "lucide-react";
import { format } from "date-fns";

interface Call {
  id: string;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  caseManager: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/calls?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCalls(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching calls:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [statusFilter, pagination.page]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground">
            View and manage your call records.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value={CallStatus.IN_PROGRESS}>In Progress</SelectItem>
            <SelectItem value={CallStatus.COMPLETED}>Completed</SelectItem>
            <SelectItem value={CallStatus.ATTEMPTED}>Attempted</SelectItem>
            <SelectItem value={CallStatus.ABANDONED}>Abandoned</SelectItem>
            <SelectItem value={CallStatus.FAILED}>Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Case Manager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No calls found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow
                  key={call.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (
                      call.status === CallStatus.IN_PROGRESS ||
                      call.status === CallStatus.RINGING ||
                      call.status === CallStatus.INITIATING
                    ) {
                      router.push(`/calls/${call.id}`);
                    } else {
                      router.push(`/calls/${call.id}/review`);
                    }
                  }}
                >
                  <TableCell>
                    <div className="font-medium">
                      {call.client.firstName} {call.client.lastName}
                    </div>
                  </TableCell>
                  <TableCell>{formatPhone(call.client.phone)}</TableCell>
                  <TableCell>
                    <CallStatusBadge status={call.status} />
                  </TableCell>
                  <TableCell>
                    {call.durationSeconds ? (
                      <CallDurationDisplay durationSeconds={call.durationSeconds} />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {call.caseManager.name || call.caseManager.email}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
