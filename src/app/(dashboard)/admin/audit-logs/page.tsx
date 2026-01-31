"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Download,
  FileText,
  ArrowLeft,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

// Types
interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  resourceName: string | null;
  details: Record<string, unknown>;
  userId: string | null;
  timestamp: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

// Action type definitions with colors and labels
const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  USER_INVITED: {
    label: "User Invited",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  USER_INVITE_RESENT: {
    label: "Invite Resent",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  USER_INVITE_REVOKED: {
    label: "Invite Revoked",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  USER_INVITE_ACCEPTED: {
    label: "Invite Accepted",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  USER_INVITE_EXPIRED: {
    label: "Invite Expired",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  USER_ROLE_CHANGED: {
    label: "Role Changed",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  USER_TEAM_CHANGED: {
    label: "Team Changed",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  USER_DETAILS_UPDATED: {
    label: "Details Updated",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  USER_DEACTIVATED: {
    label: "User Deactivated",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  USER_REACTIVATED: {
    label: "User Reactivated",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  USER_DATA_TRANSFERRED: {
    label: "Data Transferred",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  USER_DELETED: {
    label: "User Deleted",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
};

const ALL_ACTIONS = Object.keys(ACTION_CONFIG);

export default function AuditLogsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.status === 403) {
        router.push("/dashboard?error=unauthorized");
        return false;
      }
      if (response.ok) {
        setIsAuthorized(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Auth check failed:", error);
      return false;
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users?includeInactive=true");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== "all") {
        params.set("action", actionFilter);
      }
      if (userFilter && userFilter !== "all") {
        params.set("userId", userFilter);
      }
      if (startDate) {
        params.set("startDate", new Date(startDate).toISOString());
      }
      if (endDate) {
        params.set("endDate", new Date(endDate + "T23:59:59").toISOString());
      }
      params.set("limit", pagination.limit.toString());
      params.set("offset", ((pagination.page - 1) * pagination.limit).toString());

      const response = await fetch(`/api/admin/users/audit-logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.data || []);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, userFilter, startDate, endDate, pagination.page, pagination.limit]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("export", "csv");
      if (startDate) {
        params.set("startDate", new Date(startDate).toISOString());
      }
      if (endDate) {
        params.set("endDate", new Date(endDate + "T23:59:59").toISOString());
      }

      const response = await fetch(`/api/admin/users/audit-logs?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export audit logs:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setActionFilter("all");
    setUserFilter("all");
    setStartDate("");
    setEndDate("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    actionFilter !== "all" || userFilter !== "all" || startDate || endDate;

  useEffect(() => {
    const init = async () => {
      const authorized = await checkAuth();
      if (authorized) {
        fetchUsers();
      }
    };
    init();
  }, [checkAuth, fetchUsers]);

  useEffect(() => {
    if (isAuthorized) {
      fetchAuditLogs();
    }
  }, [isAuthorized, fetchAuditLogs]);

  const getActionBadge = (action: string) => {
    const config = ACTION_CONFIG[action] || {
      label: action,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
    };
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  const formatDetails = (entry: AuditLogEntry): string => {
    const details = entry.details;
    const parts: string[] = [];

    if (details.previousRole && details.newRole) {
      parts.push(`Role: ${details.previousRole} -> ${details.newRole}`);
    }
    if (details.previousTeam && details.newTeam) {
      parts.push(`Team: ${details.previousTeam} -> ${details.newTeam}`);
    }
    if (details.transferredTo) {
      parts.push(`Transferred to: ${details.transferredTo}`);
    }
    if (details.invitedRole) {
      parts.push(`Role: ${details.invitedRole}`);
    }

    return parts.join(" | ") || "-";
  };

  if (!isAuthorized && !isLoading) {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Track user management actions and changes
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={actionFilter} onValueChange={(v) => {
                setActionFilter(v);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ALL_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {ACTION_CONFIG[action].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userFilter} onValueChange={(v) => {
                setUserFilter(v);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead className="w-[160px]">Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No audit logs found</p>
                      {hasActiveFilters && (
                        <p className="text-sm mt-1">
                          Try adjusting your filters
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {format(new Date(entry.timestamp), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.timestamp), "h:mm a")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(entry.action)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {entry.resourceName || "Unknown"}
                        </p>
                        {typeof entry.details.targetEmail === "string" && (
                          <p className="text-sm text-muted-foreground">
                            {entry.details.targetEmail}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.actor ? (
                        <div>
                          <p className="font-medium">
                            {entry.actor.name || "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {entry.actor.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-left font-normal truncate max-w-[250px]"
                          >
                            {formatDetails(entry)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-2">
                            <h4 className="font-medium">Action Details</h4>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
                disabled={pagination.page === pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
