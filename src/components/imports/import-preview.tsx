"use client";

/**
 * Import Preview Component
 *
 * Shows a preview of mapped data before executing the import.
 */

import { useState } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Users, ChevronLeft, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
}

interface TargetField {
  value: string;
  label: string;
  required?: boolean;
}

interface PreviewRecord {
  rowNumber: number;
  sourceData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  duplicates?: Array<{
    clientId: string;
    clientName: string;
    matchScore: number;
  }>;
  validationErrors?: string[];
  suggestedAction?: "CREATE_NEW" | "UPDATE" | "SKIP" | "MERGE";
}

interface ImportPreviewProps {
  totalRows: number;
  mappings: FieldMapping[];
  targetFields: TargetField[];
  previewData: Record<string, unknown>[];
  previewRecords?: PreviewRecord[];
  className?: string;
}

export function ImportPreview({
  totalRows,
  mappings,
  targetFields,
  previewData,
  previewRecords,
  className,
}: ImportPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const recordsPerPage = 5;

  // Get only the mapped target fields
  const mappedFields = mappings
    .filter((m) => m.targetField)
    .map((m) => ({
      ...m,
      label: targetFields.find((f) => f.value === m.targetField)?.label || m.targetField,
    }));

  // Generate preview records if not provided
  const records: PreviewRecord[] = previewRecords || previewData.map((row, idx) => {
    const mappedData: Record<string, unknown> = {};
    for (const mapping of mappings) {
      if (mapping.targetField) {
        mappedData[mapping.targetField] = row[mapping.sourceColumn];
      }
    }
    return {
      rowNumber: idx + 1,
      sourceData: row,
      mappedData,
    };
  });

  const totalPages = Math.ceil(records.length / recordsPerPage);
  const startIndex = currentPage * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, records.length);
  const currentRecords = records.slice(startIndex, endIndex);

  // Calculate summary statistics
  const summary = {
    total: totalRows,
    previewed: records.length,
    newRecords: records.filter((r) => r.suggestedAction === "CREATE_NEW" || !r.suggestedAction).length,
    updates: records.filter((r) => r.suggestedAction === "UPDATE").length,
    duplicates: records.filter((r) => r.duplicates && r.duplicates.length > 0).length,
    errors: records.filter((r) => r.validationErrors && r.validationErrors.length > 0).length,
  };

  const getActionBadge = (action?: string) => {
    switch (action) {
      case "CREATE_NEW":
        return <Badge className="bg-green-100 text-green-700">New</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-100 text-blue-700">Update</Badge>;
      case "SKIP":
        return <Badge className="bg-gray-100 text-gray-700">Skip</Badge>;
      case "MERGE":
        return <Badge className="bg-purple-100 text-purple-700">Merge</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-700">New</Badge>;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null || value === "") {
      return "-";
    }
    const strValue = String(value);
    return strValue.length > 30 ? strValue.substring(0, 30) + "..." : strValue;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRows}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.newRecords}</p>
                <p className="text-xs text-muted-foreground">New Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.duplicates}</p>
                <p className="text-xs text-muted-foreground">Potential Duplicates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.errors}</p>
                <p className="text-xs text-muted-foreground">Validation Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Preview</CardTitle>
          <CardDescription>
            Showing {startIndex + 1}-{endIndex} of {records.length} preview records
            {records.length < totalRows && (
              <span className="text-muted-foreground"> (previewing first {records.length} of {totalRows} total)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">Row</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                  {mappedFields.map((field) => (
                    <TableHead key={field.targetField}>{field.label}</TableHead>
                  ))}
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRecords.map((record) => (
                  <TableRow
                    key={record.rowNumber}
                    className={cn(
                      record.validationErrors && record.validationErrors.length > 0 && "bg-red-50",
                      record.duplicates && record.duplicates.length > 0 && "bg-yellow-50"
                    )}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {record.rowNumber}
                    </TableCell>
                    <TableCell>{getActionBadge(record.suggestedAction)}</TableCell>
                    {mappedFields.map((field) => (
                      <TableCell key={field.targetField} className="max-w-[200px]">
                        <span className="truncate block">
                          {formatValue(record.mappedData[field.targetField])}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell>
                      {record.validationErrors && record.validationErrors.length > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {record.validationErrors.length} error(s)
                        </Badge>
                      ) : record.duplicates && record.duplicates.length > 0 ? (
                        <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-700">
                          <AlertTriangle className="h-3 w-3" />
                          {record.duplicates.length} match(es)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </Badge>
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
                Page {currentPage + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
