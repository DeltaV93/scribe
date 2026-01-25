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
import { ProgramStatusBadge } from "./program-status-badge";
import { ProgramStatus, ProgramLabelType } from "@prisma/client";
import { Loader2, Plus, Search, GraduationCap, Users, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Program {
  id: string;
  name: string;
  labelType: ProgramLabelType;
  description: string | null;
  requiredHours: number | null;
  startDate: string | null;
  endDate: string | null;
  status: ProgramStatus;
  facilitator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  _count?: {
    sessions: number;
    enrollments: number;
    materials: number;
  };
  updatedAt: string;
}

export function ProgramList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [labelType, setLabelType] = useState<string>(searchParams.get("labelType") || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (labelType && labelType !== "all") params.set("labelType", labelType);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/programs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPrograms(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [search, status, labelType, pagination.page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleLabelTypeChange = (value: string) => {
    setLabelType(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatLabelType = (type: ProgramLabelType) => {
    const labels: Record<ProgramLabelType, string> = {
      PROGRAM: "Program",
      COURSE: "Course",
      CLASS: "Class",
      WORKSHOP: "Workshop",
      TRAINING: "Training",
      GROUP: "Group",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search programs..."
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
              <SelectItem value={ProgramStatus.DRAFT}>Draft</SelectItem>
              <SelectItem value={ProgramStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={ProgramStatus.COMPLETED}>Completed</SelectItem>
              <SelectItem value={ProgramStatus.CANCELLED}>Cancelled</SelectItem>
              <SelectItem value={ProgramStatus.ARCHIVED}>Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={labelType} onValueChange={handleLabelTypeChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value={ProgramLabelType.PROGRAM}>Program</SelectItem>
              <SelectItem value={ProgramLabelType.COURSE}>Course</SelectItem>
              <SelectItem value={ProgramLabelType.CLASS}>Class</SelectItem>
              <SelectItem value={ProgramLabelType.WORKSHOP}>Workshop</SelectItem>
              <SelectItem value={ProgramLabelType.TRAINING}>Training</SelectItem>
              <SelectItem value={ProgramLabelType.GROUP}>Group</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push("/programs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Program
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Hours</TableHead>
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
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No programs found</p>
                    {search && <p className="text-sm">Try adjusting your search</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              programs.map((program) => (
                <TableRow
                  key={program.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/programs/${program.id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{program.name}</div>
                      {program.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {program.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatLabelType(program.labelType)}</span>
                  </TableCell>
                  <TableCell>
                    <ProgramStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {program.startDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(program.startDate), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-3 w-3" />
                      {program._count?.enrollments || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    {program.requiredHours ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {program.requiredHours}h
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(program.updatedAt), { addSuffix: true })}
                    </span>
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
