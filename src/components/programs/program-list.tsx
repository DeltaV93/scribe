"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { SessionStatusDropdown } from "./session-status-dropdown";
import { SessionProgressBadge } from "./session-progress-badge";
import { MaterialsQuickView, MaterialsIndicator } from "./materials-quick-view";
import { ProgramStatus, ProgramLabelType, SessionStatus } from "@prisma/client";
import {
  Loader2,
  Plus,
  Search,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Paperclip,
} from "lucide-react";
import { formatDistanceToNow, format, isPast, isFuture, isToday } from "date-fns";

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

interface Session {
  id: string;
  sessionNumber: number;
  title: string;
  topic: string | null;
  date: string | null;
  durationMinutes: number | null;
  status: SessionStatus;
  _count?: {
    attendance: number;
    materials: number;
  };
}

type SessionStatus = "completed" | "scheduled" | "in-progress" | "draft";

/**
 * Derives session status from the session date
 */
function getSessionStatus(date: string | null): SessionStatus {
  if (!date) return "draft";
  const sessionDate = new Date(date);
  if (isToday(sessionDate)) return "in-progress";
  if (isPast(sessionDate)) return "completed";
  if (isFuture(sessionDate)) return "scheduled";
  return "draft";
}

/**
 * Returns badge variant and label for session status
 */
function getSessionStatusConfig(status: SessionStatus): {
  label: string;
  variant: "default" | "secondary" | "outline" | "success";
} {
  const configs: Record<SessionStatus, { label: string; variant: "default" | "secondary" | "outline" | "success" }> = {
    completed: { label: "Completed", variant: "outline" },
    scheduled: { label: "Scheduled", variant: "default" },
    "in-progress": { label: "In Progress", variant: "success" },
    draft: { label: "Draft", variant: "secondary" },
  };
  return configs[status];
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

  // Session expansion state
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [programSessions, setProgramSessions] = useState<Record<string, Session[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());

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

  /**
   * Fetches sessions for a specific program
   */
  const fetchSessionsForProgram = useCallback(async (programId: string) => {
    // Skip if already loaded or currently loading
    if (programSessions[programId] || loadingSessions.has(programId)) {
      return;
    }

    setLoadingSessions((prev) => new Set(prev).add(programId));

    try {
      const response = await fetch(`/api/programs/${programId}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setProgramSessions((prev) => ({
          ...prev,
          [programId]: data.data,
        }));
      } else {
        console.error("Failed to fetch sessions for program:", programId);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoadingSessions((prev) => {
        const next = new Set(prev);
        next.delete(programId);
        return next;
      });
    }
  }, [programSessions, loadingSessions]);

  /**
   * Toggles session expansion for a program row
   */
  const toggleProgramExpansion = useCallback(
    (programId: string, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent row click navigation

      setExpandedPrograms((prev) => {
        const next = new Set(prev);
        if (next.has(programId)) {
          next.delete(programId);
        } else {
          next.add(programId);
          // Fetch sessions when expanding
          fetchSessionsForProgram(programId);
        }
        return next;
      });
    },
    [fetchSessionsForProgram]
  );

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
              <TableHead className="w-10"></TableHead>
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
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No programs found</p>
                    {search && <p className="text-sm">Try adjusting your search</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              programs.map((program) => {
                const isExpanded = expandedPrograms.has(program.id);
                const sessions = programSessions[program.id] || [];
                const isLoadingSessions = loadingSessions.has(program.id);
                const completedSessions = sessions.filter(
                  (s) => s.status === SessionStatus.COMPLETED
                ).length;

                return (
                  <>
                    <TableRow
                      key={program.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/programs/${program.id}`)}
                    >
                      {/* Expand/Collapse Button */}
                      <TableCell className="w-10 pr-0">
                        {(program._count?.sessions || 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => toggleProgramExpansion(program.id, e)}
                          >
                            {isLoadingSessions ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {program.name}
                            {/* Materials indicator */}
                            {(program._count?.materials || 0) > 0 && (
                              <MaterialsIndicator count={program._count?.materials || 0} />
                            )}
                          </div>
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
                        <div className="flex items-center gap-2">
                          <ProgramStatusBadge status={program.status} />
                          {/* Session progress badge (PX-726) */}
                          {(program._count?.sessions || 0) > 0 && isExpanded && (
                            <SessionProgressBadge
                              completedSessions={completedSessions}
                              totalSessions={sessions.length || program._count?.sessions || 0}
                            />
                          )}
                        </div>
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

                    {/* Expanded Session Rows (PX-721) */}
                    {isExpanded &&
                      sessions.map((session) => (
                        <TableRow
                          key={`session-${session.id}`}
                          className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            router.push(`/programs/${program.id}/sessions/${session.id}`)
                          }
                        >
                          <TableCell className="w-10"></TableCell>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">
                                #{session.sessionNumber}
                              </span>
                              <span className="text-sm font-medium">
                                {session.title || `Session ${session.sessionNumber}`}
                              </span>
                              {/* Session materials indicator */}
                              {(session._count?.materials || 0) > 0 && (
                                <MaterialsQuickView
                                  programId={program.id}
                                  sessionId={session.id}
                                  materialCount={session._count?.materials || 0}
                                />
                              )}
                            </div>
                            {session.topic && (
                              <div className="text-xs text-muted-foreground ml-8 mt-0.5">
                                {session.topic}
                              </div>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            {/* Session status dropdown (PX-724) */}
                            <SessionStatusDropdown
                              sessionId={session.id}
                              currentStatus={session.status}
                              size="sm"
                              onStatusChange={(newStatus) => {
                                // Update local state
                                setProgramSessions((prev) => ({
                                  ...prev,
                                  [program.id]: prev[program.id].map((s) =>
                                    s.id === session.id ? { ...s, status: newStatus } : s
                                  ),
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {session.date ? (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(session.date), "MMM d, yyyy")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">TBD</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {session._count?.attendance || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {session.durationMinutes ? (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {session.durationMinutes}m
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                  </>
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
