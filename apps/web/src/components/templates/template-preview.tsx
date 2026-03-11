"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, FileText, Star, Users } from "lucide-react";

interface TemplateField {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  isRequired: boolean;
  isSensitive: boolean;
  section?: string | null;
}

interface TemplateSnapshot {
  name: string;
  description?: string | null;
  type: string;
  fields: TemplateField[];
}

interface FullTemplate {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  useCaseExamples: string[];
  isSystemTemplate: boolean;
  usageCount: number;
  formSnapshot: TemplateSnapshot;
}

interface TemplatePreviewProps {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (template: FullTemplate) => void;
}

const fieldTypeLabels: Record<string, string> = {
  TEXT_SHORT: "Short Text",
  TEXT_LONG: "Long Text",
  NUMBER: "Number",
  DATE: "Date",
  PHONE: "Phone",
  EMAIL: "Email",
  ADDRESS: "Address",
  DROPDOWN: "Dropdown",
  CHECKBOX: "Checkbox",
  YES_NO: "Yes/No",
  FILE: "File Upload",
  SIGNATURE: "Signature",
};

export function TemplatePreview({
  templateId,
  open,
  onOpenChange,
  onUse,
}: TemplatePreviewProps) {
  const [template, setTemplate] = useState<FullTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templateId && open) {
      setLoading(true);
      setError(null);

      fetch(`/api/templates/${templateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTemplate(data.data);
          } else {
            setError(data.error?.message || "Failed to load template");
          }
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [templateId, open]);

  // Group fields by section
  const groupedFields = template?.formSnapshot?.fields?.reduce((acc, field) => {
    const section = field.section || "General";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, TemplateField[]>) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{template?.name || "Loading..."}</DialogTitle>
            {template?.isSystemTemplate && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                System
              </Badge>
            )}
          </div>
          {template?.description && (
            <DialogDescription>{template.description}</DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">{error}</div>
        ) : template ? (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4">
              {/* Template info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{template.formSnapshot?.fields?.length || 0} fields</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{template.usageCount} uses</span>
                </div>
                <Badge variant="outline">{template.formSnapshot?.type}</Badge>
              </div>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Use cases */}
              {template.useCaseExamples.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Use Cases</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {template.useCaseExamples.map((example, i) => (
                      <li key={i}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Fields by section */}
              <div>
                <h4 className="text-sm font-medium mb-3">Form Fields</h4>
                <div className="space-y-4">
                  {Object.entries(groupedFields).map(([section, fields]) => (
                    <div key={section}>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">
                        {section}
                      </h5>
                      <div className="space-y-2">
                        {fields.map((field) => (
                          <div
                            key={field.slug}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {field.name}
                              </span>
                              {field.isRequired && (
                                <span className="text-destructive">*</span>
                              )}
                              {field.isSensitive && (
                                <Badge variant="outline" className="text-xs">
                                  Sensitive
                                </Badge>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {fieldTypeLabels[field.type] || field.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => template && onUse(template)} disabled={!template}>
            <Copy className="h-4 w-4 mr-1" />
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
