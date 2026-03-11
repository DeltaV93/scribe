"use client";

/**
 * Export Templates List Page
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileDown, Loader2, ArrowLeft } from "lucide-react";

interface ExportTemplate {
  id: string;
  name: string;
  description: string | null;
  exportType: string;
  status: string;
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string;
  };
  _count: { exports: number };
}

const exportTypeLabels: Record<string, string> = {
  HUD_HMIS: "HUD HMIS",
  DOL_WIPS: "DOL WIPS",
  CAP60: "CAP60",
  CALI_GRANTS: "CalGrants",
  CUSTOM: "Custom",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-700",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchTemplates();
  }, [statusFilter, typeFilter]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("exportType", typeFilter);

      const res = await fetch(`/api/exports/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/exports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Export Templates</h1>
          <p className="text-muted-foreground">
            Manage your funder export configurations
          </p>
        </div>
        <Link href="/exports/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="HUD_HMIS">HUD HMIS</SelectItem>
            <SelectItem value="DOL_WIPS">DOL WIPS</SelectItem>
            <SelectItem value="CAP60">CAP60</SelectItem>
            <SelectItem value="CALI_GRANTS">CalGrants</SelectItem>
            <SelectItem value="CUSTOM">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileDown className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first export template to get started
            </p>
            <Link href="/exports/templates/new">
              <Button>Create Template</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Link key={template.id} href={`/exports/templates/${template.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge className={statusColors[template.status]}>
                      {template.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {template.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{exportTypeLabels[template.exportType]}</span>
                    <span>{template._count.exports} exports</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Created by {template.createdBy.name || template.createdBy.email}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > templates.length && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Showing {templates.length} of {total} templates
          </p>
        </div>
      )}
    </div>
  );
}
