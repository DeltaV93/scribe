"use client";

/**
 * Export History Page
 *
 * View and manage past exports.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileDown,
} from "lucide-react";

interface Export {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  recordCount: number | null;
  createdAt: string;
  generatedAt: string | null;
  template: {
    id: string;
    name: string;
    exportType: string;
  };
  generatedBy: {
    name: string | null;
    email: string;
  };
}

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  VALIDATION_REQUIRED: "bg-orange-100 text-orange-700",
};

export default function ExportHistoryPage() {
  const [exports, setExports] = useState<Export[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchExports();
  }, [statusFilter]);

  async function fetchExports() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/exports/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExports(data.exports || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching exports:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(exportId: string) {
    setDownloading(exportId);
    try {
      const res = await fetch(`/api/exports/${exportId}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) {
          window.open(data.downloadUrl, "_blank");
        }
      }
    } catch (error) {
      console.error("Error downloading:", error);
    } finally {
      setDownloading(null);
    }
  }

  async function handleRetry(exportId: string) {
    try {
      const res = await fetch(`/api/exports/${exportId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      if (res.ok) {
        fetchExports();
      }
    } catch (error) {
      console.error("Error retrying:", error);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "FAILED":
      case "VALIDATION_REQUIRED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "PROCESSING":
        return <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/exports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Export History</h1>
          <p className="text-muted-foreground">
            View and download past exports
          </p>
        </div>
        <Button variant="outline" onClick={fetchExports}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="VALIDATION_REQUIRED">Needs Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileDown className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-muted-foreground">No exports found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{exp.template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exp.template.exportType.replace("_", " ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {new Date(exp.periodStart).toLocaleDateString()} -{" "}
                        {new Date(exp.periodEnd).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      {exp.recordCount !== null ? (
                        <span className="font-mono">{exp.recordCount}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(exp.status)}
                        <Badge className={statusColors[exp.status]}>
                          {exp.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {new Date(exp.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exp.generatedBy.name || exp.generatedBy.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {exp.status === "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(exp.id)}
                            disabled={downloading === exp.id}
                          >
                            {downloading === exp.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {(exp.status === "FAILED" ||
                          exp.status === "VALIDATION_REQUIRED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(exp.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={`/exports/${exp.id}`}>
                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > exports.length && (
        <p className="text-center text-sm text-muted-foreground">
          Showing {exports.length} of {total} exports
        </p>
      )}
    </div>
  );
}
