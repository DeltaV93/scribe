"use client";

/**
 * Import Detail Page
 *
 * Shows details of a specific import batch including progress and records.
 */

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Users,
  RefreshCw,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { toast } from "sonner";
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
  startedAt: string | null;
  completedAt: string | null;
  rollbackAvailableUntil: string | null;
  rollbackExecutedAt: string | null;
  detectedColumns: string[];
  fieldMappings: Array<{ sourceColumn: string; targetField: string }> | null;
  validationErrors: Array<{ rowNumber: number; message: string }> | null;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ImportRecord {
  id: string;
  rowNumber: number;
  status: string;
  action: string | null;
  sourceData: Record<string, unknown>;
  mappedData: Record<string, unknown> | null;
  validationErrors: { error?: string } | null;
  createdClientId: string | null;
  updatedClientId: string | null;
  processedAt: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: { icon: <Clock className="h-5 w-5" />, color: "text-blue-600", label: "Pending" },
  PARSING: { icon: <Loader2 className="h-5 w-5 animate-spin" />, color: "text-blue-600", label: "Parsing" },
  MAPPING: { icon: <Loader2 className="h-5 w-5 animate-spin" />, color: "text-purple-600", label: "Mapping" },
  READY: { icon: <AlertTriangle className="h-5 w-5" />, color: "text-yellow-600", label: "Ready" },
  PROCESSING: { icon: <Loader2 className="h-5 w-5 animate-spin" />, color: "text-purple-600", label: "Processing" },
  COMPLETED: { icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-600", label: "Completed" },
  FAILED: { icon: <AlertCircle className="h-5 w-5" />, color: "text-red-600", label: "Failed" },
  ROLLED_BACK: { icon: <RotateCcw className="h-5 w-5" />, color: "text-gray-600", label: "Rolled Back" },
};

const recordStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  CREATED: "bg-green-100 text-green-700",
  UPDATED: "bg-blue-100 text-blue-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  ROLLED_BACK: "bg-gray-100 text-gray-700",
};

interface PageProps {
  params: Promise<{ importId: string }>;
}

export default function ImportDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState(false);
  const [recordsPage, setRecordsPage] = useState(0);
  const recordsPerPage = 20;

  const fetchBatch = async () => {
    try {
      const res = await fetch(`/api/imports/${resolvedParams.importId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Import batch not found");
          router.push("/imports");
          return;
        }
        throw new Error("Failed to fetch batch");
      }
      const data = await res.json();
      setBatch(data.batch);
      setRecords(data.records || []);
    } catch (error) {
      console.error("Error fetching batch:", error);
      toast.error("Failed to load import details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();

    // Poll for updates if processing
    const interval = setInterval(() => {
      if (batch?.status === "PROCESSING" || batch?.status === "PENDING") {
        fetchBatch();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [resolvedParams.importId, batch?.status]);

  const handleRollback = async () => {
    setRollingBack(true);
    try {
      const res = await fetch(`/api/imports/${resolvedParams.importId}/rollback`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to rollback import");
        return;
      }

      toast.success("Import rolled back successfully");
      await fetchBatch();
    } catch (error) {
      console.error("Rollback error:", error);
      toast.error("Failed to rollback import");
    } finally {
      setRollingBack(false);
    }
  };

  const canRollback = (): boolean => {
    if (!batch) return false;
    if (batch.status !== "COMPLETED") return false;
    if (!batch.rollbackAvailableUntil) return false;
    if (batch.rollbackExecutedAt) return false;
    return new Date(batch.rollbackAvailableUntil) > new Date();
  };

  const getRollbackTimeRemaining = (): string => {
    if (!batch?.rollbackAvailableUntil) return "";
    const remaining = new Date(batch.rollbackAvailableUntil).getTime() - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getProgress = (): number => {
    if (!batch?.totalRows) return 0;
    return Math.round((batch.processedRows / batch.totalRows) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Import batch not found.</p>
      </div>
    );
  }

  const status = statusConfig[batch.status] || statusConfig.PENDING;
  const paginatedRecords = records.slice(
    recordsPage * recordsPerPage,
    (recordsPage + 1) * recordsPerPage
  );
  const totalPages = Math.ceil(records.length / recordsPerPage);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/imports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold">{batch.fileName}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Uploaded by {batch.uploadedBy.name || batch.uploadedBy.email} on{" "}
              {formatDate(batch.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBatch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canRollback() && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={rollingBack}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rollback ({getRollbackTimeRemaining()})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rollback Import?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {batch.createdCount} clients created during this import.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRollback} className="bg-red-600 hover:bg-red-700">
                    {rollingBack ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Rollback Import
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <Card className={cn(
        "border-2",
        batch.status === "COMPLETED" && "border-green-200 bg-green-50",
        batch.status === "FAILED" && "border-red-200 bg-red-50",
        batch.status === "PROCESSING" && "border-purple-200 bg-purple-50",
        batch.status === "ROLLED_BACK" && "border-gray-200 bg-gray-50"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-full", status.color.replace("text-", "bg-").replace("600", "100"))}>
                {status.icon}
              </div>
              <div>
                <p className="text-lg font-semibold">{status.label}</p>
                <p className="text-sm text-muted-foreground">
                  {batch.status === "PROCESSING" && `Processing ${batch.processedRows} of ${batch.totalRows} records...`}
                  {batch.status === "COMPLETED" && `Completed at ${formatDate(batch.completedAt!)}`}
                  {batch.status === "FAILED" && "Import failed. See error details below."}
                  {batch.status === "ROLLED_BACK" && `Rolled back at ${formatDate(batch.rollbackExecutedAt!)}`}
                </p>
              </div>
            </div>
            {batch.status === "PROCESSING" && (
              <div className="w-48">
                <Progress value={getProgress()} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {getProgress()}% complete
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{batch.totalRows || 0}</p>
            <p className="text-sm text-muted-foreground">Total Records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-green-600">{batch.createdCount}</p>
            <p className="text-sm text-muted-foreground">Created</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-blue-600">{batch.updatedCount}</p>
            <p className="text-sm text-muted-foreground">Updated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-gray-600">{batch.skippedCount}</p>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-red-600">{batch.failedCount}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Validation Errors */}
      {batch.validationErrors && batch.validationErrors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Validation Errors
            </CardTitle>
            <CardDescription>
              {batch.validationErrors.length} error(s) occurred during import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {batch.validationErrors.slice(0, 20).map((error, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">Row {error.rowNumber}</Badge>
                  <span className="text-red-600">{error.message}</span>
                </div>
              ))}
              {batch.validationErrors.length > 20 && (
                <p className="text-sm text-muted-foreground">
                  ... and {batch.validationErrors.length - 20} more errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Records */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Import Records</CardTitle>
                <CardDescription>
                  Showing {recordsPage * recordsPerPage + 1}-
                  {Math.min((recordsPage + 1) * recordsPerPage, records.length)} of {records.length} records
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead>Data Preview</TableHead>
                    <TableHead className="w-[150px]">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono">{record.rowNumber}</TableCell>
                      <TableCell>
                        <Badge className={recordStatusColors[record.status] || recordStatusColors.PENDING}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.action && (
                          <Badge variant="outline">{record.action}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="text-sm truncate">
                          {record.mappedData ? (
                            <>
                              {record.mappedData["client.firstName"]} {record.mappedData["client.lastName"]}
                              {record.mappedData["client.phone"] && (
                                <span className="text-muted-foreground ml-2">
                                  ({String(record.mappedData["client.phone"])})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {JSON.stringify(record.sourceData).substring(0, 50)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.createdClientId && (
                          <Link href={`/clients/${record.createdClientId}`}>
                            <Button variant="link" size="sm" className="h-auto p-0">
                              <Users className="h-3 w-3 mr-1" />
                              View Client
                            </Button>
                          </Link>
                        )}
                        {record.updatedClientId && (
                          <Link href={`/clients/${record.updatedClientId}`}>
                            <Button variant="link" size="sm" className="h-auto p-0">
                              <Users className="h-3 w-3 mr-1" />
                              View Client
                            </Button>
                          </Link>
                        )}
                        {record.validationErrors?.error && (
                          <span className="text-xs text-red-600">
                            {record.validationErrors.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {recordsPage + 1} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                    disabled={recordsPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecordsPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={recordsPage === totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Field Mappings */}
      {batch.fieldMappings && batch.fieldMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Field Mappings Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {batch.fieldMappings.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                  <span className="font-mono">{mapping.sourceColumn}</span>
                  <span className="text-muted-foreground">-&gt;</span>
                  <span className="font-medium">{mapping.targetField.replace("client.", "")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
