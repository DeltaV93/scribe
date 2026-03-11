"use client";

import { useState, useEffect, useCallback } from "react";
import { TemplateCard, Template } from "@/components/templates/template-card";
import { TemplatePreview } from "@/components/templates/template-preview";
import { CreateFromTemplateModal } from "@/components/templates/create-from-template-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Search, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "system" | "organization">("all");

  // Modal states
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [createFromTemplate, setCreateFromTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Get unique tags from templates
  const allTags = Array.from(new Set(templates.flatMap((t) => t.tags)));

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      selectedTags.forEach((tag) => params.append("tag", tag));
      if (filter === "system") params.append("systemOnly", "true");

      const response = await fetch(`/api/templates?${params}`);
      const data = await response.json();

      if (data.success) {
        let filtered = data.data;
        if (filter === "organization") {
          filtered = data.data.filter((t: Template) => !t.isSystemTemplate);
        }
        setTemplates(filtered);
      } else {
        toast.error("Failed to load templates");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [search, selectedTags, filter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTemplates();
    }, 300);

    return () => clearTimeout(debounce);
  }, [fetchTemplates]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplateId(template.id);
  };

  const handleUse = (template: Template) => {
    setCreateFromTemplate(template);
    setPreviewTemplateId(null);
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/templates/${deleteTemplate.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Template deleted");
        setDeleteTemplate(null);
        fetchTemplates();
      } else {
        toast.error(data.error?.message || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Form Templates</h1>
          <p className="text-muted-foreground">
            Start with a pre-built template or browse your organization&apos;s templates
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleToggleTag(tag)}
            >
              {tag}
              {selectedTags.includes(tag) && (
                <X className="h-3 w-3 ml-1" />
              )}
            </Badge>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags([])}
              className="text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No templates found</h3>
          <p className="text-muted-foreground">
            {search || selectedTags.length > 0
              ? "Try adjusting your search or filters"
              : "Templates you create will appear here"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={handlePreview}
              onUse={handleUse}
              onDelete={
                !template.isSystemTemplate
                  ? () => setDeleteTemplate(template)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Template Preview Modal */}
      <TemplatePreview
        templateId={previewTemplateId}
        open={!!previewTemplateId}
        onOpenChange={(open) => !open && setPreviewTemplateId(null)}
        onUse={(template) => {
          setCreateFromTemplate({
            id: template.id,
            name: template.name,
            description: template.description,
            tags: template.tags,
            thumbnail: null,
            useCaseExamples: template.useCaseExamples,
            isSystemTemplate: template.isSystemTemplate,
            usageCount: template.usageCount,
            fieldCount: template.formSnapshot?.fields?.length || 0,
            createdAt: "",
          });
          setPreviewTemplateId(null);
        }}
      />

      {/* Create From Template Modal */}
      {createFromTemplate && (
        <CreateFromTemplateModal
          templateId={createFromTemplate.id}
          templateName={createFromTemplate.name}
          open={!!createFromTemplate}
          onOpenChange={(open) => !open && setCreateFromTemplate(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTemplate}
        onOpenChange={(open) => !open && setDeleteTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTemplate?.name}&rdquo;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
