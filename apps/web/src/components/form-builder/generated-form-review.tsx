"use client";

import { useState, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  aiGenerationAtom,
  acceptGeneratedFieldsAtom,
  resetGenerationAtom,
  startGenerationAtom,
} from "@/lib/form-builder/store";
import { groupFieldsBySection, getFieldSummary } from "@/lib/ai/generation";
import { FIELD_TYPE_CONFIG, PURPOSE_CONFIG } from "@/types";
import type { GeneratedFieldData } from "@/lib/ai/generation-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Shield,
  Bot,
  Info,
} from "lucide-react";

interface GeneratedFormReviewProps {
  onStartOver: () => void;
}

export function GeneratedFormReview({ onStartOver }: GeneratedFormReviewProps) {
  const [aiState] = useAtom(aiGenerationAtom);
  const acceptFields = useSetAtom(acceptGeneratedFieldsAtom);
  const resetGeneration = useSetAtom(resetGenerationAtom);
  const startGeneration = useSetAtom(startGenerationAtom);

  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(() => {
    // Default: all fields selected
    return new Set(aiState.generatedFields?.map((f) => f.id) || []);
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Default: all sections expanded
    const sections = new Set<string>();
    aiState.generatedFields?.forEach((f) => {
      sections.add(f.section || "Other");
    });
    return sections;
  });

  const [isRegenerating, setIsRegenerating] = useState(false);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    if (!aiState.generatedFields) return new Map();
    return groupFieldsBySection(aiState.generatedFields);
  }, [aiState.generatedFields]);

  // Get summary stats
  const summary = useMemo(() => {
    if (!aiState.generatedFields) return null;
    const selected = aiState.generatedFields.filter((f) =>
      selectedFieldIds.has(f.id)
    );
    return {
      total: getFieldSummary(aiState.generatedFields),
      selected: getFieldSummary(selected),
    };
  }, [aiState.generatedFields, selectedFieldIds]);

  // Get extraction suggestion for a field
  const getExtractionSuggestion = (fieldSlug: string) => {
    return aiState.extractionSuggestions?.find((s) => s.fieldSlug === fieldSlug);
  };

  const toggleField = (fieldId: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const selectAllInSection = (section: string) => {
    const sectionFields = fieldsBySection.get(section) || [];
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      sectionFields.forEach((f: GeneratedFieldData) => next.add(f.id));
      return next;
    });
  };

  const deselectAllInSection = (section: string) => {
    const sectionFields = fieldsBySection.get(section) || [];
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      sectionFields.forEach((f: GeneratedFieldData) => next.delete(f.id));
      return next;
    });
  };

  const handleAccept = () => {
    acceptFields(Array.from(selectedFieldIds));
  };

  const handleRegenerate = async () => {
    if (!aiState.request) return;
    setIsRegenerating(true);
    try {
      await startGeneration(aiState.request);
      // Reset selections to all
      setSelectedFieldIds(
        new Set(aiState.generatedFields?.map((f) => f.id) || [])
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleStartOver = () => {
    resetGeneration();
    onStartOver();
  };

  if (!aiState.generatedFields || aiState.generatedFields.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No fields were generated.</p>
          <Button variant="outline" className="mt-4" onClick={handleStartOver}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* AI Reasoning */}
        {aiState.reasoning && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{aiState.reasoning}</p>
            </CardContent>
          </Card>
        )}

        {/* Field Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Fields</CardTitle>
            <CardDescription>
              Review and select which fields to include in your form. You can
              edit them after accepting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {Array.from(fieldsBySection.entries()).map(
                  ([section, fields]) => {
                    const isExpanded = expandedSections.has(section);
                    const selectedCount = fields.filter((f: GeneratedFieldData) =>
                      selectedFieldIds.has(f.id)
                    ).length;
                    const allSelected = selectedCount === fields.length;
                    const someSelected = selectedCount > 0 && !allSelected;

                    return (
                      <Collapsible
                        key={section}
                        open={isExpanded}
                        onOpenChange={() => toggleSection(section)}
                      >
                        <div className="flex items-center gap-2 py-2 border-b">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <span className="font-medium flex-1">{section}</span>
                          <Badge variant="secondary">
                            {selectedCount}/{fields.length}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (allSelected) {
                                deselectAllInSection(section);
                              } else {
                                selectAllInSection(section);
                              }
                            }}
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </Button>
                        </div>
                        <CollapsibleContent>
                          <div className="space-y-2 pt-2 pl-6">
                            {fields.map((field: GeneratedFieldData) => (
                              <FieldRow
                                key={field.id}
                                field={field}
                                isSelected={selectedFieldIds.has(field.id)}
                                onToggle={() => toggleField(field.id)}
                                extractionSuggestion={getExtractionSuggestion(
                                  field.slug
                                )}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {summary && (
          <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
            <div className="flex gap-4">
              <span>
                <strong>{summary.selected.total}</strong> of{" "}
                {summary.total.total} fields selected
              </span>
              <span className="text-primary">
                <Bot className="inline h-3 w-3 mr-1" />
                {summary.selected.aiExtractable} AI-extractable
              </span>
              {summary.selected.sensitive > 0 && (
                <span className="text-amber-600">
                  <Shield className="inline h-3 w-3 mr-1" />
                  {summary.selected.sensitive} sensitive
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`}
              />
              Regenerate
            </Button>
            <Button variant="ghost" onClick={handleStartOver}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
          <Button
            onClick={handleAccept}
            disabled={selectedFieldIds.size === 0}
          >
            <Check className="mr-2 h-4 w-4" />
            Accept & Continue
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Individual field row component
interface FieldRowProps {
  field: GeneratedFieldData;
  isSelected: boolean;
  onToggle: () => void;
  extractionSuggestion?: {
    extractionHint: string;
    expectedFormat: string;
    exampleValues: string[];
  } | null;
}

function FieldRow({
  field,
  isSelected,
  onToggle,
  extractionSuggestion,
}: FieldRowProps) {
  const fieldConfig = FIELD_TYPE_CONFIG[field.type];
  const purposeConfig = PURPOSE_CONFIG[field.purpose];

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isSelected ? "bg-primary/5 border-primary/20" : "bg-background hover:bg-muted/50"
      }`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{field.name}</span>
          {field.isRequired && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
          {field.isSensitive && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
              <Shield className="h-3 w-3 mr-1" />
              Sensitive
            </Badge>
          )}
          {field.isAiExtractable && (
            <Badge variant="outline" className="text-xs text-primary border-primary/20">
              <Bot className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {fieldConfig?.label || field.type}
          </span>
          <span className="text-xs">{purposeConfig?.label || field.purpose}</span>
        </div>
        {field.helpText && (
          <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
        )}
        {field.options && field.options.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {field.options.slice(0, 5).map((opt) => (
              <Badge key={opt.value} variant="secondary" className="text-xs">
                {opt.label}
              </Badge>
            ))}
            {field.options.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{field.options.length - 5} more
              </Badge>
            )}
          </div>
        )}
        {extractionSuggestion && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 mt-2 text-xs text-primary cursor-help">
                <Info className="h-3 w-3" />
                <span>Extraction hint available</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-1">
                <p className="font-medium">How AI will extract this:</p>
                <p>{extractionSuggestion.extractionHint}</p>
                {extractionSuggestion.expectedFormat && (
                  <p className="text-muted-foreground">
                    Format: {extractionSuggestion.expectedFormat}
                  </p>
                )}
                {extractionSuggestion.exampleValues?.length > 0 && (
                  <p className="text-muted-foreground">
                    Examples: {extractionSuggestion.exampleValues.join(", ")}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{field.reasoning}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
