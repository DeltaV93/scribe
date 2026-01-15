"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FormField {
  id: string;
  slug: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

interface FormSection {
  formId: string;
  formName: string;
  fields: FormField[];
}

interface ConversationGuideProps {
  sections: FormSection[];
  completedFields: Set<string>;
  onFieldToggle: (fieldId: string) => void;
}

export function ConversationGuide({
  sections,
  completedFields,
  onFieldToggle,
}: ConversationGuideProps) {
  const [expandedForms, setExpandedForms] = useState<Set<string>>(
    new Set(sections.map((s) => s.formId))
  );

  const toggleFormExpanded = (formId: string) => {
    const newExpanded = new Set(expandedForms);
    if (newExpanded.has(formId)) {
      newExpanded.delete(formId);
    } else {
      newExpanded.add(formId);
    }
    setExpandedForms(newExpanded);
  };

  const getFormProgress = (section: FormSection) => {
    const total = section.fields.length;
    const completed = section.fields.filter((f) =>
      completedFields.has(f.id)
    ).length;
    return { total, completed };
  };

  if (sections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversation Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No forms selected for this call. You can still take notes and the AI
            will extract information from the conversation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Conversation Guide</CardTitle>
        <p className="text-xs text-muted-foreground">
          Check off fields as you gather information
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4 pr-4">
            {sections.map((section) => {
              const { total, completed } = getFormProgress(section);
              const isExpanded = expandedForms.has(section.formId);

              return (
                <div key={section.formId} className="border rounded-lg">
                  {/* Form Header */}
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50"
                    onClick={() => toggleFormExpanded(section.formId)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{section.formName}</span>
                    </div>
                    <Badge variant={completed === total ? "success" : "secondary"}>
                      {completed}/{total}
                    </Badge>
                  </button>

                  {/* Form Fields */}
                  {isExpanded && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-2">
                      {section.fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-start space-x-2 py-1"
                        >
                          <Checkbox
                            id={field.id}
                            checked={completedFields.has(field.id)}
                            onCheckedChange={() => onFieldToggle(field.id)}
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={field.id}
                              className="text-sm cursor-pointer"
                            >
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </Label>
                            {field.description && (
                              <p className="text-xs text-muted-foreground">
                                {field.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
