"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GrantStatusBadge } from "./grant-status-badge";
import { DeliverableProgress } from "./deliverable-progress";
import { GrantStatus } from "@prisma/client";
import { Loader2, Plus, Search, FileText, Calendar, Target } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Grant {
  id: string;
  name: string;
  funderName: string | null;
  grantNumber: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  status: GrantStatus;
  reportingFrequency: string | null;
  _count?: {
    deliverables: number;
  };
  deliverables?: Array<{
    currentValue: number;
    targetValue: number;
  }>;
  updatedAt: string;
}

export function GrantList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [grants, setGrants] = useState<Grant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchGrants = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/grants?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGrants(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching grants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [search, status, pagination.page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const calculateOverallProgress = (grant: Grant) => {
    if (!grant.deliverables || grant.deliverables.length === 0) {
      return { current: 0, target: 0 };
    }
    const current = grant.deliverables.reduce((sum, d) => sum + d.currentValue, 0);
    const target = grant.deliverables.reduce((sum, d) => sum + d.targetValue, 0);
    return { current, target };
  };

  const formatDateRange = (start: string, end: string) => {
    return `${format(new Date(start), "MMM d, yyyy")} - ${format(new Date(end), "MMM d, yyyy")}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search grants..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={GrantStatus.DRAFT}>Draft</SelectItem>
              <SelectItem value={GrantStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={GrantStatus.COMPLETED}>Completed</SelectItem>
              <SelectItem value={GrantStatus.EXPIRED}>Expired</SelectItem>
              <SelectItem value={GrantStatus.ARCHIVED}>Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push("/grants/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Grant
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grant</TableHead>
              <TableHead>Funder</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Deliverables</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : grants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No grants found</p>
                    {search && <p className="text-sm">Try adjusting your search</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              grants.map((grant) => {
                const progress = calculateOverallProgress(grant);
                return (
                  <TableRow
                    key={grant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/grants/${grant.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{grant.name}</div>
                        {grant.grantNumber && (
                          <div className="text-sm text-muted-foreground">
                            #{grant.grantNumber}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {grant.funderName || <span className="text-muted-foreground">-</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <GrantStatusBadge status={grant.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateRange(grant.startDate, grant.endDate)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Target className="h-3 w-3" />
                        {grant._count?.deliverables || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-32">
                        <DeliverableProgress
                          currentValue={progress.current}
                          targetValue={progress.target}
                          size="sm"
                          showLabel={false}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {progress.target > 0
                            ? `${Math.round((progress.current / progress.target) * 100)}%`
                            : "No targets"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(grant.updatedAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
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
