"use client";

/**
 * Integration Dashboard Page
 *
 * Central monitoring dashboard for export status, scheduling, and history.
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileDown,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Play,
  Settings,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

interface DashboardData {
  summary: {
    totalTemplates: number;
    totalExports: number;
    successRate: number;
    statusCounts: Record<string, number>;
    scheduledTemplates: number;
  };
  templates: Array<{
    id: string;
    name: string;
    exportType: string;
    totalExports: number;
    schedule: {
      enabled: boolean;
      cronExpression: string | null;
      description: string | null;
      lastRunAt: string | null;
      nextRunAt: string | null;
      failureCount: number;
    };
    lastExport: {
      id: string;
      status: string;
      recordCount: number | null;
      createdAt: string;
    } | null;
  }>;
  recentExports: Array<{
    id: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    recordCount: number | null;
    createdAt: string;
    template: {
      id: string;
      name: string;
      exportType: string;
    };
  }>;
  needsAttention: Array<{
    id: string;
    status: string;
    template: { name: string };
  }>;
  upcomingScheduled: Array<{
    templateId: string;
    templateName: string;
    nextRunAt: string;
    scheduleDescription: string;
  }>;
}

const exportTypeLabels: Record<string, string> = {
  HUD_HMIS: "HUD HMIS",
  DOL_WIPS: "DOL WIPS",
  CAP60: "CAP60",
  CALI_GRANTS: "CalGrants",
  CUSTOM: "Custom",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  VALIDATION_REQUIRED: "bg-orange-100 text-orange-700",
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-4 w-4 text-blue-500" />,
  PROCESSING: <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
  VALIDATION_REQUIRED: <AlertTriangle className="h-4 w-4 text-orange-500" />,
};

export default function IntegrationDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringExport, setTriggeringExport] = useState<string | null>(null);

  const fetchDashboard = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/exports/dashboard");
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchDashboard(), 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerExport = async (templateId: string) => {
    setTriggeringExport(templateId);
    try {
      const res = await fetch(`/api/exports/templates/${templateId}/schedule`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh dashboard after triggering
        await fetchDashboard(true);
      }
    } catch (error) {
      console.error("Error triggering export:", error);
    } finally {
      setTriggeringExport(null);
    }
  };

  if (loading || !data) {
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
          <h1 className="text-2xl font-bold">Integration Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor exports across all funder systems
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Exports</p>
                <p className="text-3xl font-bold">{data.summary.totalExports}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileDown className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold">{data.summary.successRate}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress value={data.summary.successRate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-3xl font-bold">{data.summary.scheduledTemplates}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {data.summary.totalTemplates} templates
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-3xl font-bold">{data.needsAttention.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  failed or validation required
                </p>
              </div>
              <div className={`p-3 rounded-lg ${data.needsAttention.length > 0 ? "bg-red-100" : "bg-gray-100"}`}>
                <Activity className={`h-6 w-6 ${data.needsAttention.length > 0 ? "text-red-600" : "text-gray-600"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention Alert */}
      {data.needsAttention.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Exports Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.needsAttention.slice(0, 5).map((exp) => (
                <Link
                  key={exp.id}
                  href={`/exports/${exp.id}`}
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {statusIcons[exp.status]}
                    <span className="font-medium">{exp.template.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[exp.status]}>
                      {exp.status.replace("_", " ")}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Export Templates
            </CardTitle>
            <CardDescription>
              Status and scheduling for each template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Export</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exportTypeLabels[template.exportType]}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.schedule.enabled ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-green-500" />
                                <span className="text-sm">
                                  {template.schedule.description || "Scheduled"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {template.schedule.nextRunAt && (
                                <p>
                                  Next: {new Date(template.schedule.nextRunAt).toLocaleString()}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not scheduled</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.lastExport ? (
                        <div className="flex items-center gap-2">
                          {statusIcons[template.lastExport.status]}
                          <span className="text-sm">
                            {template.lastExport.recordCount ?? 0} records
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => triggerExport(template.id)}
                        disabled={triggeringExport === template.id}
                      >
                        {triggeringExport === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Upcoming Scheduled */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Scheduled Exports
            </CardTitle>
            <CardDescription>
              Next scheduled export runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingScheduled.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-muted-foreground">No scheduled exports</p>
                <Link href="/exports/templates">
                  <Button variant="link">Configure schedules</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.upcomingScheduled.map((scheduled) => (
                  <div
                    key={scheduled.templateId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{scheduled.templateName}</p>
                      <p className="text-sm text-muted-foreground">
                        {scheduled.scheduleDescription}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {new Date(scheduled.nextRunAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(scheduled.nextRunAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Exports</CardTitle>
              <CardDescription>Latest export runs across all templates</CardDescription>
            </div>
            <Link href="/exports/history">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentExports.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{exp.template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exportTypeLabels[exp.template.exportType]}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(exp.periodStart).toLocaleDateString()} -{" "}
                      {new Date(exp.periodEnd).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {exp.recordCount !== null ? exp.recordCount : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[exp.status]}
                      <Badge className={statusColors[exp.status]}>
                        {exp.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/exports/${exp.id}`}>
                      <Button size="sm" variant="ghost">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
