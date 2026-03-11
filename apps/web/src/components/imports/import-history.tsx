"use client";

/**
 * Import History Component
 *
 * Displays a list of past import batches with status and actions.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ImportBatch {
  id: string;
  fileName: string;
  status: string;
  totalRows: number | null;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
  rollbackAvailableUntil: string | null;
  uploadedBy: {
    id: string;
    name: string | null;
  };
}

interface ImportHistoryProps {
  initialBatches?: ImportBatch[];
  showTitle?: boolean;
  limit?: number;
  className?: string;
  onRollback?: (batchId: string) => Promise<void>;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: {
    icon: <Clock className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-700",
    label: "Pending",
  },
  PARSING: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "bg-blue-100 text-blue-700",
    label: "Parsing",
  },
  MAPPING: {
    icon: <Wand2 className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-700",
    label: "Mapping",
  },
  READY: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-yellow-100 text-yellow-700",
    label: "Ready",
  },
  PROCESSING: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "bg-purple-100 text-purple-700",
    label: "Processing",
  },
  COMPLETED: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-green-100 text-green-700",
    label: "Completed",
  },
  FAILED: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "bg-red-100 text-red-700",
    label: "Failed",
  },
  ROLLED_BACK: {
    icon: <RotateCcw className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-700",
    label: "Rolled Back",
  },
};

export function ImportHistory({
  initialBatches,
  showTitle = true,
  limit = 10,
  className,
  onRollback,
}: ImportHistoryProps) {
  const [batches, setBatches] = useState<ImportBatch[]>(initialBatches || []);
  const [loading, setLoading] = useState(!initialBatches);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    if (!initialBatches) {
      fetchBatches();
    }
  }, [initialBatches, limit]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/imports/history?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error("Error fetching import history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    if (!onRollback) return;

    try {
      setRollingBack(batchId);
      await onRollback(batchId);
      await fetchBatches();
    } catch (error) {
      console.error("Rollback failed:", error);
    } finally {
      setRollingBack(null);
    }
  };

  const canRollback = (batch: ImportBatch): boolean => {
    if (batch.status !== "COMPLETED") return false;
    if (!batch.rollbackAvailableUntil) return false;
    return new Date(batch.rollbackAvailableUntil) > new Date();
  };

  const getRollbackTimeRemaining = (batch: ImportBatch): string => {
    if (!batch.rollbackAvailableUntil) return "";
    const remaining = new Date(batch.rollbackAvailableUntil).getTime() - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Import History</CardTitle>
                <CardDescription>Recent data import batches</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchBatches}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className={cn(!showTitle && "pt-6")}>
          {batches.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No imports yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a file to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const status = statusConfig[batch.status] || statusConfig.PENDING;

                  return (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium truncate max-w-[200px]">
                              {batch.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {batch.totalRows || 0} rows
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("p-1 rounded", status.color.split(" ")[0])}>
                            {status.icon}
                          </span>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {batch.status === "COMPLETED" && (
                          <div className="flex flex-wrap gap-1 text-xs">
                            {batch.createdCount > 0 && (
                              <span className="text-green-600">
                                +{batch.createdCount} created
                              </span>
                            )}
                            {batch.updatedCount > 0 && (
                              <span className="text-blue-600">
                                {batch.updatedCount} updated
                              </span>
                            )}
                            {batch.skippedCount > 0 && (
                              <span className="text-gray-500">
                                {batch.skippedCount} skipped
                              </span>
                            )}
                            {batch.failedCount > 0 && (
                              <span className="text-red-600">
                                {batch.failedCount} failed
                              </span>
                            )}
                          </div>
                        )}
                        {batch.status === "PROCESSING" && (
                          <div className="text-xs text-muted-foreground">
                            {batch.processedRows} / {batch.totalRows || "?"} processed
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(batch.createdAt)}
                        </div>
                        {batch.uploadedBy.name && (
                          <p className="text-xs text-muted-foreground">
                            by {batch.uploadedBy.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canRollback(batch) && onRollback && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRollback(batch.id)}
                                  disabled={rollingBack === batch.id}
                                >
                                  {rollingBack === batch.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Rollback import ({getRollbackTimeRemaining(batch)})
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Link href={`/imports/${batch.id}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
