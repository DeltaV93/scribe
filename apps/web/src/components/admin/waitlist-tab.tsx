"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Search,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type WaitlistStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

interface WaitlistEntry {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  teamSize: string;
  industry: string;
  status: WaitlistStatus;
  submittedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  approvedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface WaitlistCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
}

interface WaitlistTabProps {
  onDataChange?: () => void;
}

const statusColors: Record<WaitlistStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
};

export function WaitlistTab({ onDataChange }: WaitlistTabProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [counts, setCounts] = useState<WaitlistCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState(10);
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (search) {
        params.set("search", search);
      }
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/admin/waitlist?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
        setCounts(data.counts);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch waitlist:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });

      if (response.ok) {
        await fetchWaitlist();
        onDataChange?.();
      }
    } catch (error) {
      console.error("Failed to approve entry:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });

      if (response.ok) {
        await fetchWaitlist();
        onDataChange?.();
      }
    } catch (error) {
      console.error("Failed to reject entry:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchApprove = async () => {
    setBatchLoading(true);
    try {
      const response = await fetch("/api/admin/waitlist/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: batchCount }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully approved ${data.approvedCount} entries`);
        await fetchWaitlist();
        onDataChange?.();
      }
    } catch (error) {
      console.error("Failed to batch approve:", error);
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {counts.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                {counts.pending}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Check className="h-5 w-5 text-blue-500" />
                {counts.approved}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {counts.completed}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                {counts.rejected}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Batch Approve */}
      {counts && counts.pending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Approve</CardTitle>
            <CardDescription>
              Approve the next N pending entries in submission order (FIFO)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Input
              type="number"
              min={1}
              max={100}
              value={batchCount}
              onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
              className="w-24"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={batchLoading}>
                  {batchLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Approve Next {batchCount}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Batch Approve</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will approve the next {batchCount} pending entries and send them
                    invitation emails. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBatchApprove}>
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or organization..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as WaitlistStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No waitlist entries found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.firstName} {entry.lastName}
                    </TableCell>
                    <TableCell>{entry.email}</TableCell>
                    <TableCell>{entry.organization}</TableCell>
                    <TableCell>{entry.role}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(entry.submittedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[entry.status]}
                      >
                        {entry.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(entry.id)}
                            disabled={actionLoading === entry.id}
                          >
                            {actionLoading === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(entry.id)}
                            disabled={actionLoading === entry.id}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                      {entry.status === "APPROVED" && entry.approvedBy && (
                        <span className="text-xs text-muted-foreground">
                          by {entry.approvedBy.name || entry.approvedBy.email}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
