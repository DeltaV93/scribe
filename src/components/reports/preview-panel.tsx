"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Eye,
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface MetricPreview {
  name: string;
  value: string;
  benchmarkStatus?: "below" | "good" | "excellent";
  previousValue?: string;
  change?: number;
}

interface PreviewPanelProps {
  templateId: string;
  templateName: string;
  reportType: string;
  metrics: MetricPreview[];
  isPreviewMode?: boolean;
  onGeneratePreview?: () => Promise<void>;
}

const STATUS_CONFIG = {
  below: {
    label: "Below Target",
    color: "bg-red-100 text-red-800",
    icon: TrendingDown,
  },
  good: {
    label: "On Track",
    color: "bg-blue-100 text-blue-800",
    icon: Minus,
  },
  excellent: {
    label: "Exceeding",
    color: "bg-green-100 text-green-800",
    icon: TrendingUp,
  },
};

export function PreviewPanel({
  templateId,
  templateName,
  reportType,
  metrics,
  isPreviewMode = true,
  onGeneratePreview,
}: PreviewPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleDownloadPreview = async () => {
    setIsLoading(true);
    try {
      // Request preview PDF generation
      const response = await fetch(`/api/reports/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriod: {
            start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to generate preview");

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName}_preview.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Preview downloaded");
    } catch (error) {
      toast.error("Failed to download preview");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Report Preview</CardTitle>
            <CardDescription>
              {isPreviewMode
                ? "Anonymized preview with sample data"
                : "Live data from your reporting period"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Full Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Report Preview</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[70vh]">
                  <div className="p-6 space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                      <h1 className="text-2xl font-bold">{templateName}</h1>
                      <p className="text-muted-foreground">{reportType}</p>
                      <Badge variant="outline">PREVIEW - Sample Data</Badge>
                    </div>

                    <Separator />

                    {/* Executive Summary Placeholder */}
                    <div>
                      <h2 className="text-lg font-semibold mb-3">
                        Executive Summary
                      </h2>
                      <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                        [Preview - Narrative content will be generated when the
                        report is finalized. This section will include an AI-generated
                        summary of your organization's key achievements and metrics.]
                      </div>
                    </div>

                    {/* Metrics Section */}
                    <div>
                      <h2 className="text-lg font-semibold mb-3">
                        Performance Metrics
                      </h2>
                      <div className="grid grid-cols-2 gap-4">
                        {metrics.map((metric, index) => (
                          <MetricCard key={index} metric={metric} />
                        ))}
                      </div>
                    </div>

                    {/* Outcomes Placeholder */}
                    <div>
                      <h2 className="text-lg font-semibold mb-3">
                        Outcomes Analysis
                      </h2>
                      <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                        [Preview - This section will analyze your program outcomes
                        based on the selected metrics and provide context for
                        stakeholders.]
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPreview}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isPreviewMode && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg mb-4 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Preview shows anonymized sample data. Actual values will be calculated
              when generating the final report.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.slice(0, 6).map((metric, index) => (
            <MetricCard key={index} metric={metric} compact />
          ))}
        </div>

        {metrics.length > 6 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            And {metrics.length - 6} more metrics...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  metric,
  compact = false,
}: {
  metric: MetricPreview;
  compact?: boolean;
}) {
  const statusConfig = metric.benchmarkStatus
    ? STATUS_CONFIG[metric.benchmarkStatus]
    : null;
  const StatusIcon = statusConfig?.icon || Minus;

  return (
    <div
      className={`p-4 border rounded-lg ${compact ? "" : "bg-background"}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{metric.name}</p>
          <p className={`font-bold ${compact ? "text-xl" : "text-2xl"} mt-1`}>
            {metric.value}
          </p>
        </div>
        {statusConfig && (
          <Badge className={statusConfig.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {compact ? "" : statusConfig.label}
          </Badge>
        )}
      </div>

      {metric.previousValue && metric.change !== undefined && (
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span className="text-muted-foreground">vs. last period:</span>
          <span
            className={
              metric.change >= 0 ? "text-green-600" : "text-red-600"
            }
          >
            {metric.change >= 0 ? "+" : ""}
            {metric.change.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
