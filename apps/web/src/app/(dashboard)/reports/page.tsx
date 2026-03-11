import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listReports, listReportTemplates } from "@/lib/services/reporting";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Download,
  Eye,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ReportStatus } from "@prisma/client";

function getStatusBadge(status: ReportStatus) {
  switch (status) {
    case "GENERATING":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "REVIEW_REQUIRED":
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
          <AlertCircle className="h-3 w-3" />
          Review Required
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateRange(start: Date, end: Date) {
  const startStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(start));

  const endStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(end));

  return `${startStr} - ${endStr}`;
}

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch reports and templates
  const [reportsResult, templatesResult] = await Promise.all([
    listReports(user.orgId, { limit: 10 }),
    listReportTemplates(user.orgId, { status: "PUBLISHED", limit: 5 }),
  ]);

  const { reports } = reportsResult;
  const { templates } = templatesResult;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and manage automated reports for funders and stakeholders.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports/schedules">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Scheduled Reports
            </Button>
          </Link>
          <Link href="/reports/generate">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Generate</CardTitle>
            <CardDescription>
              Generate a report from one of your published templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  href={`/reports/generate?templateId=${template.id}`}
                >
                  <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    {template.name}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Reports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          <Link href="/reports?view=all">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg mb-2">No reports yet</CardTitle>
              <CardDescription className="text-center mb-4">
                Get started by generating your first report.
              </CardDescription>
              <Link href="/reports/generate">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate your first report
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{report.templateName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDateRange(
                            report.reportingPeriodStart,
                            report.reportingPeriodEnd
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(report.status)}

                      {report.generatedAt && (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(report.generatedAt)}
                        </span>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/reports/${report.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {report.status === "COMPLETED" && report.pdfUrl && (
                            <DropdownMenuItem asChild>
                              <a href={report.pdfUrl} download>
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Report Templates Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Report Templates</h2>
          <Link href="/reports/templates">
            <Button variant="ghost" size="sm">
              Manage Templates
            </Button>
          </Link>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CardDescription className="text-center mb-4">
                Create report templates to automate your reporting workflow.
              </CardDescription>
              <Link href="/reports/templates/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {template.description || "No description"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">{template.type}</Badge>
                    <Badge variant="secondary">
                      {template._count?.reports || 0} reports
                    </Badge>
                  </div>
                  <Link href={`/reports/generate?templateId=${template.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Generate Report
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
