"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronLeft,
  FileText,
  Check,
  Circle,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { InPersonRecorder } from "./in-person-recorder";
import { FormSelector } from "./form-selector";

// ============================================
// TYPES
// ============================================

interface FormField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string | null;
}

interface FormSection {
  name: string;
  fields: FormField[];
}

interface FormGuide {
  id: string;
  name: string;
  type: string;
  sections: FormSection[];
  fieldCount: number;
}

interface GuideData {
  conversationId: string;
  forms: FormGuide[];
  totalFields: number;
}

interface InPersonSessionViewProps {
  conversationId: string;
  uploadUrl?: string;
  maxDurationMinutes?: number;
  title?: string;
  initialFormIds?: string[];
  onRecordingStart?: () => void;
  onRecordingStop?: (duration: number) => void;
  onUploadComplete?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

// ============================================
// GUIDE PANEL COMPONENT
// ============================================

function GuidePanel({
  conversationId,
  isOpen,
  onToggle,
  checkedFields,
  onFieldCheck,
}: {
  conversationId: string;
  isOpen: boolean;
  onToggle: () => void;
  checkedFields: Set<string>;
  onFieldCheck: (fieldId: string) => void;
}) {
  const [guideData, setGuideData] = useState<GuideData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);

  // Fetch guide data
  const fetchGuideData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/guide`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch guide");
      }

      setGuideData(data);
      // Expand all forms by default
      setExpandedForms(new Set(data.forms.map((f: FormGuide) => f.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchGuideData();
  }, [fetchGuideData]);

  // Handle adding forms mid-session
  const handleAddForms = async () => {
    if (selectedFormIds.length === 0) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}/forms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: selectedFormIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to add forms");
      }

      // Refresh guide data
      await fetchGuideData();
      setSelectedFormIds([]);
      setShowFormSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add forms");
    }
  };

  const toggleFormExpanded = (formId: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  };

  // Calculate progress
  const getFormProgress = (form: FormGuide) => {
    const allFieldIds = form.sections.flatMap((s) => s.fields.map((f) => f.id));
    const checked = allFieldIds.filter((id) => checkedFields.has(id)).length;
    return { checked, total: allFieldIds.length };
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed right-4 top-20 z-10 gap-2"
      >
        <FileText className="h-4 w-4" />
        Guide
        <ChevronLeft className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card className="w-80 flex-shrink-0 h-fit max-h-[calc(100vh-8rem)] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Conversation Guide
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {guideData && guideData.totalFields > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {checkedFields.size} of {guideData.totalFields} fields covered
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 py-4">{error}</div>
          )}

          {!isLoading && !error && guideData && (
            <div className="space-y-4">
              {guideData.forms.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No forms linked. Add forms to see a field guide.
                </div>
              ) : (
                guideData.forms.map((form) => {
                  const progress = getFormProgress(form);
                  const isExpanded = expandedForms.has(form.id);

                  return (
                    <Collapsible
                      key={form.id}
                      open={isExpanded}
                      onOpenChange={() => toggleFormExpanded(form.id)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 flex-shrink-0 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                          <span className="text-sm font-medium truncate">
                            {form.name}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {progress.checked}/{progress.total}
                        </Badge>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="pl-6 space-y-2 mt-2">
                        {form.sections.map((section) => (
                          <div key={section.name} className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {section.name}
                            </div>
                            {section.fields.map((field) => {
                              const isChecked = checkedFields.has(field.id);
                              return (
                                <button
                                  key={field.id}
                                  onClick={() => onFieldCheck(field.id)}
                                  className={cn(
                                    "flex items-start gap-2 w-full text-left p-1.5 rounded text-sm transition-colors",
                                    isChecked
                                      ? "text-muted-foreground line-through"
                                      : "hover:bg-muted/50"
                                  )}
                                >
                                  {isChecked ? (
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                                  )}
                                  <span className="flex-1">
                                    {field.label}
                                    {field.required && (
                                      <span className="text-red-500 ml-0.5">*</span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}

              {/* Add more forms */}
              <div className="pt-2 border-t">
                {showFormSelector ? (
                  <div className="space-y-2">
                    <FormSelector
                      selectedFormIds={selectedFormIds}
                      onFormsChange={setSelectedFormIds}
                      placeholder="Select additional forms..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddForms}
                        disabled={selectedFormIds.length === 0}
                        className="flex-1"
                      >
                        Add Forms
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowFormSelector(false);
                          setSelectedFormIds([]);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFormSelector(true)}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Forms
                  </Button>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InPersonSessionView({
  conversationId,
  uploadUrl,
  maxDurationMinutes,
  title,
  initialFormIds = [],
  onRecordingStart,
  onRecordingStop,
  onUploadComplete,
  onError,
}: InPersonSessionViewProps) {
  const [guideOpen, setGuideOpen] = useState(initialFormIds.length > 0);
  const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set());

  const handleFieldCheck = useCallback((fieldId: string) => {
    setCheckedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex gap-4">
      {/* Main recording area */}
      <div className="flex-1">
        <InPersonRecorder
          conversationId={conversationId}
          uploadUrl={uploadUrl}
          maxDurationMinutes={maxDurationMinutes}
          onRecordingStart={onRecordingStart}
          onRecordingStop={onRecordingStop}
          onUploadComplete={onUploadComplete}
          onError={onError}
        />
      </div>

      {/* Guide panel */}
      <GuidePanel
        conversationId={conversationId}
        isOpen={guideOpen}
        onToggle={() => setGuideOpen((prev) => !prev)}
        checkedFields={checkedFields}
        onFieldCheck={handleFieldCheck}
      />
    </div>
  );
}
