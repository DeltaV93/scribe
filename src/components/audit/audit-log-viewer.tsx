"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText,
  User,
  Clock,
  Filter,
  RefreshCw,
  ChevronDown,
  Eye,
  Download,
  Loader2,
} from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry, AuditAction, AuditResource } from "@/lib/audit/types";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  VIEW: "bg-gray-100 text-gray-800",
  EXPORT: "bg-purple-100 text-purple-800",
  PUBLISH: "bg-yellow-100 text-yellow-800",
  UPLOAD: "bg-cyan-100 text-cyan-800",
  DOWNLOAD: "bg-indigo-100 text-indigo-800",
  LOGIN: "bg-emerald-100 text-emerald-800",
  LOGOUT: "bg-orange-100 text-orange-800",
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  FORM: <FileText className="h-4 w-4" />,
  USER: <User className="h-4 w-4" />,
  FILE: <FileText className="h-4 w-4" />,
};

export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [resourceFilter, setResourceFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("offset", String(page * 20));
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resource", resourceFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(`/api/audit?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const response = await fetch("/api/audit/verify");
      if (response.ok) {
        const data = await response.json();
        setChainValid(data.valid);
      }
    } catch (error) {
      console.error("Failed to verify chain:", error);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, resourceFilter, startDate, endDate]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Chain Integrity Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Chain Integrity
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={verifyChain}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verify Chain
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chainValid === null ? (
            <p className="text-sm text-muted-foreground">
              Click "Verify Chain" to check the integrity of the audit log
            </p>
          ) : chainValid ? (
            <div className="flex items-center gap-2 text-green-600">
              <ShieldCheck className="h-5 w-5" />
              <span>All audit entries verified - chain is intact</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              <span>Chain integrity compromised - some entries may have been tampered with</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="VIEW">View</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
                <SelectItem value="PUBLISH">Publish</SelectItem>
                <SelectItem value="UPLOAD">Upload</SelectItem>
                <SelectItem value="DOWNLOAD">Download</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Resources</SelectItem>
                <SelectItem value="FORM">Form</SelectItem>
                <SelectItem value="SUBMISSION">Submission</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="FILE">File</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
            />

            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Audit Log ({total} entries)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No audit entries found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <Collapsible key={entry.id} asChild>
                      <>
                        <TableRow>
                          <TableCell className="text-sm">
                            {formatDate(entry.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={ACTION_COLORS[entry.action] || "bg-gray-100"}
                            >
                              {entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {RESOURCE_ICONS[entry.resource] || (
                                <FileText className="h-4 w-4" />
                              )}
                              <span>{entry.resource}</span>
                              {entry.resourceName && (
                                <span className="text-muted-foreground text-sm">
                                  ({entry.resourceName})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                                <ChevronDown className="h-4 w-4 ml-1" />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.userId || "System"}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/50">
                              <div className="p-4 space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Resource ID:</span>{" "}
                                    <code className="bg-muted px-1 rounded">
                                      {entry.resourceId}
                                    </code>
                                  </div>
                                  <div>
                                    <span className="font-medium">IP Address:</span>{" "}
                                    {entry.ipAddress || "N/A"}
                                  </div>
                                  <div>
                                    <span className="font-medium">Entry Hash:</span>{" "}
                                    <code className="bg-muted px-1 rounded text-xs">
                                      {entry.hash.substring(0, 16)}...
                                    </code>
                                  </div>
                                  <div>
                                    <span className="font-medium">Previous Hash:</span>{" "}
                                    <code className="bg-muted px-1 rounded text-xs">
                                      {entry.previousHash.substring(0, 16)}...
                                    </code>
                                  </div>
                                </div>
                                {Object.keys(entry.details).length > 0 && (
                                  <div>
                                    <span className="font-medium text-sm">Details:</span>
                                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                                      {JSON.stringify(entry.details, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * 20 + 1} - {Math.min((page + 1) * 20, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * 20 >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
