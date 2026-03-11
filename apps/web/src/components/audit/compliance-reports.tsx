"use client";

import { useState, useEffect } from "react";
import {
  FileBarChart,
  Plus,
  Download,
  ShieldCheck,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ComplianceReport, ComplianceReportType } from "@/lib/audit/types";

const REPORT_TYPE_LABELS: Record<ComplianceReportType, string> = {
  ACTIVITY_SUMMARY: "Activity Summary",
  DATA_ACCESS: "Data Access Report",
  USER_ACTIVITY: "User Activity Report",
  FORM_SUBMISSIONS: "Form Submissions Report",
  FILE_AUDIT: "File Audit Report",
  CHAIN_INTEGRITY: "Chain Integrity Report",
};

const REPORT_TYPE_DESCRIPTIONS: Record<ComplianceReportType, string> = {
  ACTIVITY_SUMMARY: "Overview of all activity in the specified period",
  DATA_ACCESS: "Detailed log of who accessed what data",
  USER_ACTIVITY: "Breakdown of activity by user",
  FORM_SUBMISSIONS: "Summary of form submissions",
  FILE_AUDIT: "Audit of file uploads and downloads",
  CHAIN_INTEGRITY: "Verification of audit chain integrity",
};

export function ComplianceReports() {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New report form
  const [reportType, setReportType] = useState<ComplianceReportType>("ACTIVITY_SUMMARY");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/compliance/reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/compliance/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, startDate, endDate }),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchReports();
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (reportId: string, format: "json" | "csv") => {
    const url = `/api/compliance/reports/${reportId}${format === "csv" ? "?format=csv" : ""}`;
    const response = await fetch(url);

    if (format === "csv") {
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `report-${reportId}.csv`;
      a.click();
    } else {
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `report-${reportId}.json`;
      a.click();
    }
  };

  const verifyReport = async (reportId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/compliance/reports/${reportId}?verify=true`);
      if (response.ok) {
        const data = await response.json();
        return data.verification.valid;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Compliance Reports</h2>
          <p className="text-muted-foreground">
            Generate and manage compliance reports for auditing
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Compliance Report</DialogTitle>
              <DialogDescription>
                Select the report type and date range
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select
                  value={reportType}
                  onValueChange={(v) => setReportType(v as ComplianceReportType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {REPORT_TYPE_DESCRIPTIONS[reportType]}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={generateReport} disabled={generating}>
                {generating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No reports generated yet</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDownload={downloadReport}
              onVerify={verifyReport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onDownload,
  onVerify,
}: {
  report: ComplianceReport;
  onDownload: (id: string, format: "json" | "csv") => void;
  onVerify: (id: string) => Promise<boolean>;
}) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    const result = await onVerify(report.id);
    setVerified(result);
    setVerifying(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="mb-2">
              {REPORT_TYPE_LABELS[report.reportType]}
            </Badge>
            <CardTitle className="text-base">
              {formatDateRange(report.startDate, report.endDate)}
            </CardTitle>
          </div>
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Generated {new Date(report.generatedAt).toLocaleDateString()}
          </div>

          {/* Summary stats if available */}
          {report.data.summary && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(report.data.summary)
                .slice(0, 4)
                .map(([key, value]) => (
                  <div key={key} className="bg-muted/50 p-2 rounded">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </span>
                    <span className="font-medium ml-1">
                      {typeof value === "number" ? value.toLocaleString() : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Verification status */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-1" />
              )}
              Verify
            </Button>
            {verified !== null && (
              <span className="flex items-center gap-1 text-sm">
                {verified ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">Invalid</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Download buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onDownload(report.id, "csv")}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onDownload(report.id, "json")}
            >
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateRange(start: Date | string, end: Date | string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}
