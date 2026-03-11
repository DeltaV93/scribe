"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  Archive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  publishedAt?: string;
  createdBy: {
    name: string | null;
    email: string;
  };
  _count?: {
    reports: number;
  };
}

interface TemplateManagerProps {
  templates: ReportTemplate[];
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    variant: "outline" as const,
    icon: Edit,
  },
  PUBLISHED: {
    label: "Published",
    variant: "default" as const,
    icon: CheckCircle,
  },
  ARCHIVED: {
    label: "Archived",
    variant: "secondary" as const,
    icon: Archive,
  },
};

const TYPE_LABELS: Record<string, string> = {
  HUD_APR: "HUD APR",
  DOL_WORKFORCE: "DOL Workforce",
  CALI_GRANTS: "California Grants",
  BOARD_REPORT: "Board Report",
  IMPACT_REPORT: "Impact Report",
  CUSTOM: "Custom",
};

export function TemplateManager({ templates, onRefresh }: TemplateManagerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [templateToArchive, setTemplateToArchive] = useState<ReportTemplate | null>(
    null
  );

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePublish = async (templateId: string) => {
    setIsPublishing(templateId);
    try {
      const response = await fetch(
        `/api/reports/templates/${templateId}/publish`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to publish");
      }

      toast.success("Template published successfully");
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish template"
      );
    } finally {
      setIsPublishing(null);
    }
  };

  const handleArchive = async () => {
    if (!templateToArchive) return;

    setIsArchiving(templateToArchive.id);
    try {
      const response = await fetch(
        `/api/reports/templates/${templateToArchive.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to archive template");
      }

      toast.success("Template archived");
      onRefresh();
    } catch (error) {
      toast.error("Failed to archive template");
    } finally {
      setIsArchiving(null);
      setTemplateToArchive(null);
    }
  };

  const handleGenerateReport = (templateId: string) => {
    router.push(`/reports/generate?templateId=${templateId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Report Templates</h2>
          <p className="text-sm text-muted-foreground">
            Manage your report templates and generate reports
          </p>
        </div>
        <Button onClick={() => router.push("/reports/templates/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No templates found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? "Try a different search term"
                : "Create your first report template to get started"}
            </p>
            {!searchQuery && (
              <Button
                className="mt-4"
                onClick={() => router.push("/reports/templates/new")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => {
            const statusConfig = STATUS_CONFIG[template.status];
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        <Badge variant="outline">
                          {TYPE_LABELS[template.type] || template.type}
                        </Badge>
                      </div>
                      {template.description && (
                        <CardDescription className="mt-1">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {template.status === "DRAFT" && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/reports/templates/${template.id}/edit`)
                              }
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePublish(template.id)}
                              disabled={isPublishing === template.id}
                            >
                              {isPublishing === template.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Publish
                            </DropdownMenuItem>
                          </>
                        )}
                        {template.status === "PUBLISHED" && (
                          <DropdownMenuItem
                            onClick={() => handleGenerateReport(template.id)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Report
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setTemplateToArchive(template)}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Created{" "}
                      {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                    {template.publishedAt && (
                      <div>
                        Published{" "}
                        {new Date(template.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                    <div>
                      By {template.createdBy.name || template.createdBy.email}
                    </div>
                    {template._count && (
                      <div>
                        {template._count.reports} report
                        {template._count.reports !== 1 ? "s" : ""} generated
                      </div>
                    )}
                  </div>

                  {template.status === "PUBLISHED" && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleGenerateReport(template.id)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog
        open={!!templateToArchive}
        onOpenChange={() => setTemplateToArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive "{templateToArchive?.name}". Archived templates
              cannot be used to generate new reports, but existing reports will
              remain accessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving !== null}
            >
              {isArchiving && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
