"use client";

/**
 * Export Center Page
 *
 * Main page for managing funder data exports.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileDown,
  Plus,
  Settings,
  History,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LayoutDashboard,
} from "lucide-react";

interface ExportTemplate {
  id: string;
  name: string;
  exportType: string;
  status: string;
  createdAt: string;
  _count: { exports: number };
}

interface RecentExport {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  recordCount: number | null;
  createdAt: string;
  template: {
    name: string;
    exportType: string;
  };
}

const exportTypeLabels: Record<string, string> = {
  HUD_HMIS: "HUD HMIS",
  DOL_WIPS: "DOL WIPS",
  CAP60: "CAP60",
  CALI_GRANTS: "CalGrants",
  CUSTOM: "Custom",
};

const exportTypeIcons: Record<string, React.ReactNode> = {
  HUD_HMIS: <FileSpreadsheet className="h-5 w-5" />,
  DOL_WIPS: <FileText className="h-5 w-5" />,
  CAP60: <FileSpreadsheet className="h-5 w-5" />,
  CALI_GRANTS: <FileSpreadsheet className="h-5 w-5" />,
  CUSTOM: <FileDown className="h-5 w-5" />,
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
  PENDING: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  VALIDATION_REQUIRED: "bg-orange-100 text-orange-700",
};

export default function ExportsPage() {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [templatesRes, exportsRes] = await Promise.all([
          fetch("/api/exports/templates?limit=6"),
          fetch("/api/exports/history?limit=5"),
        ]);

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }

        if (exportsRes.ok) {
          const data = await exportsRes.json();
          setRecentExports(data.exports || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getStatusIcon = (status: string) => {
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
          <h1 className="text-2xl font-bold">Export Center</h1>
          <p className="text-muted-foreground">
            Export client data in funder-specific formats
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/exports/dashboard">
            <Button variant="outline">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/exports/templates/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/exports/templates/new?type=HUD_HMIS">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                {exportTypeIcons.HUD_HMIS}
              </div>
              <div>
                <p className="font-medium">HUD HMIS</p>
                <p className="text-sm text-muted-foreground">Homeless services</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/exports/templates/new?type=DOL_WIPS">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-green-100 rounded-lg">
                {exportTypeIcons.DOL_WIPS}
              </div>
              <div>
                <p className="font-medium">DOL WIPS</p>
                <p className="text-sm text-muted-foreground">Workforce programs</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/exports/templates/new?type=CAP60">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                {exportTypeIcons.CAP60}
              </div>
              <div>
                <p className="font-medium">CAP60</p>
                <p className="text-sm text-muted-foreground">CSBG reporting</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <Link href="/exports/templates/new?type=CALI_GRANTS">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 bg-orange-100 rounded-lg">
                {exportTypeIcons.CALI_GRANTS}
              </div>
              <div>
                <p className="font-medium">CalGrants</p>
                <p className="text-sm text-muted-foreground">California grants</p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">
            <Settings className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="recent">
            <History className="h-4 w-4 mr-2" />
            Recent Exports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Export Templates</CardTitle>
                  <CardDescription>
                    Configure templates for each funder format
                  </CardDescription>
                </div>
                <Link href="/exports/templates">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileDown className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-muted-foreground">No templates yet</p>
                  <Link href="/exports/templates/new">
                    <Button variant="link">Create your first template</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y">
                  {templates.map((template) => (
                    <Link
                      key={template.id}
                      href={`/exports/templates/${template.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded">
                          {exportTypeIcons[template.exportType]}
                        </div>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {exportTypeLabels[template.exportType]} •{" "}
                            {template._count.exports} exports
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColors[template.status]}>
                        {template.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Exports</CardTitle>
                  <CardDescription>
                    Latest export runs and their status
                  </CardDescription>
                </div>
                <Link href="/exports/history">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentExports.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-muted-foreground">No exports yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentExports.map((exp) => (
                    <Link
                      key={exp.id}
                      href={`/exports/${exp.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(exp.status)}
                        <div>
                          <p className="font-medium">{exp.template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(exp.periodStart).toLocaleDateString()} -{" "}
                            {new Date(exp.periodEnd).toLocaleDateString()}
                            {exp.recordCount && ` • ${exp.recordCount} records`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={statusColors[exp.status]}>
                          {exp.status.replace("_", " ")}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(exp.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
