"use client";

/**
 * Import Center Page
 *
 * Main page for importing client data from external files.
 */

import { useState, useEffect, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  RotateCcw,
  Users,
  AlertTriangle,
  Wand2,
} from "lucide-react";

interface ImportBatch {
  id: string;
  fileName: string;
  status: string;
  totalRows: number | null;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
  rollbackAvailableUntil: string | null;
  uploadedBy: { name: string | null };
}

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  confidence?: number;
  aiSuggested?: boolean;
}

interface UploadResult {
  batchId: string;
  fileName: string;
  totalRows: number;
  columns: string[];
  preview: Record<string, unknown>[];
  suggestedMappings: FieldMapping[];
}

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  PARSING: "bg-blue-100 text-blue-700",
  MAPPING: "bg-purple-100 text-purple-700",
  READY: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  ROLLED_BACK: "bg-gray-100 text-gray-700",
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-blue-500" />,
  PARSING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  MAPPING: <Wand2 className="h-4 w-4 text-purple-500" />,
  READY: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  PROCESSING: <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
  ROLLED_BACK: <RotateCcw className="h-4 w-4 text-gray-500" />,
};

const TARGET_FIELDS = [
  { value: "client.firstName", label: "First Name" },
  { value: "client.lastName", label: "Last Name" },
  { value: "client.phone", label: "Phone" },
  { value: "client.email", label: "Email" },
  { value: "client.address.street", label: "Street Address" },
  { value: "client.address.city", label: "City" },
  { value: "client.address.state", label: "State" },
  { value: "client.address.zip", label: "ZIP Code" },
  { value: "client.internalId", label: "External ID" },
  { value: "", label: "-- Skip --" },
];

export default function ImportsPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [duplicateEnabled, setDuplicateEnabled] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/imports/history?limit=10");
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/imports/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to upload file");
        return;
      }

      const result: UploadResult = await res.json();
      setUploadResult(result);
      setFieldMappings(result.suggestedMappings);
      setShowMappingDialog(true);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const updateMapping = (column: string, targetField: string) => {
    setFieldMappings((prev) => {
      const existing = prev.find((m) => m.sourceColumn === column);
      if (existing) {
        if (!targetField) {
          return prev.filter((m) => m.sourceColumn !== column);
        }
        return prev.map((m) =>
          m.sourceColumn === column ? { ...m, targetField, aiSuggested: false } : m
        );
      }
      if (targetField) {
        return [...prev, { sourceColumn: column, targetField, aiSuggested: false }];
      }
      return prev;
    });
  };

  const executeImport = async () => {
    if (!uploadResult) return;

    // Validate required fields
    const mappedTargets = new Set(fieldMappings.map((m) => m.targetField));
    const requiredFields = ["client.firstName", "client.lastName", "client.phone"];
    const missing = requiredFields.filter((f) => !mappedTargets.has(f));

    if (missing.length > 0) {
      alert(`Please map required fields: ${missing.join(", ")}`);
      return;
    }

    setExecuting(true);

    try {
      const res = await fetch("/api/imports/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: uploadResult.batchId,
          fieldMappings,
          duplicateSettings: {
            enabled: duplicateEnabled,
            matchFields: [
              { field: "client.firstName", weight: 0.3, matchType: "fuzzy" },
              { field: "client.lastName", weight: 0.3, matchType: "fuzzy" },
              { field: "client.phone", weight: 0.25, matchType: "normalized" },
              { field: "client.email", weight: 0.15, matchType: "exact" },
            ],
            threshold: 0.8,
            defaultAction: "SKIP",
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to execute import");
        return;
      }

      // Close dialog and refresh
      setShowMappingDialog(false);
      setUploadResult(null);
      await fetchBatches();
    } catch (error) {
      console.error("Error executing import:", error);
      alert("Failed to execute import");
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Center</h1>
          <p className="text-muted-foreground">
            Import client data from CSV, Excel, or JSON files
          </p>
        </div>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label htmlFor="file-upload">
            <Button asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload File
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">How Import Works</h3>
              <ol className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>1. Upload a CSV, Excel, or JSON file</li>
                <li>2. Review AI-suggested field mappings and adjust as needed</li>
                <li>3. Preview duplicate detection results</li>
                <li>4. Execute import (rollback available for 24 hours)</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
          <CardDescription>History of import batches</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 mx-auto text-gray-300 mb-3" />
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
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{batch.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.totalRows || 0} rows
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[batch.status]}
                        <Badge className={statusColors[batch.status]}>
                          {batch.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {batch.status === "COMPLETED" && (
                        <div className="text-sm space-x-2">
                          <span className="text-green-600">
                            +{batch.createdCount} created
                          </span>
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
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/imports/${batch.id}`}>
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Field Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Import</DialogTitle>
            <DialogDescription>
              {uploadResult?.fileName} - {uploadResult?.totalRows} rows detected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Field Mappings */}
            <div>
              <h3 className="font-medium mb-3">Field Mappings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Map columns from your file to Scrybe fields. AI has suggested mappings
                marked with a sparkle icon.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>Sample Value</TableHead>
                    <TableHead>Target Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResult?.columns.map((column) => {
                    const mapping = fieldMappings.find((m) => m.sourceColumn === column);
                    const sampleValue = uploadResult?.preview[0]?.[column];

                    return (
                      <TableRow key={column}>
                        <TableCell className="font-medium">
                          {column}
                          {mapping?.aiSuggested && (
                            <Wand2 className="h-3 w-3 inline ml-2 text-purple-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {String(sampleValue || "")}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.targetField || ""}
                            onValueChange={(value) => updateMapping(column, value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Duplicate Detection */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="duplicate-detection">Duplicate Detection</Label>
                <p className="text-sm text-muted-foreground">
                  Check for existing clients with similar names, phone, or email
                </p>
              </div>
              <Switch
                id="duplicate-detection"
                checked={duplicateEnabled}
                onCheckedChange={setDuplicateEnabled}
              />
            </div>

            {/* Preview */}
            <div>
              <h3 className="font-medium mb-3">Data Preview</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fieldMappings
                        .filter((m) => m.targetField)
                        .map((m) => (
                          <TableHead key={m.targetField}>
                            {TARGET_FIELDS.find((f) => f.value === m.targetField)?.label}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResult?.preview.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        {fieldMappings
                          .filter((m) => m.targetField)
                          .map((m) => (
                            <TableCell key={m.targetField}>
                              {String(row[m.sourceColumn] || "")}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={executeImport} disabled={executing}>
              {executing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Import {uploadResult?.totalRows || 0} Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
