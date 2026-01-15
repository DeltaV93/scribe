"use client";

import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  formBuilderAtom,
  aiExtractableFieldsAtom,
  updateFieldAtom,
  sortedFieldsAtom,
} from "@/lib/form-builder/store";
import { FIELD_TYPE_CONFIG, type FormFieldData } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,
  FlaskConical,
} from "lucide-react";
import { ExtractionTester } from "@/components/ai";

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return "text-green-600";
  if (confidence >= 60) return "text-amber-600";
  return "text-red-600";
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 80) return { label: "High", variant: "default" as const };
  if (confidence >= 60) return { label: "Medium", variant: "secondary" as const };
  return { label: "Low", variant: "destructive" as const };
}

function AIFieldRow({ field }: { field: FormFieldData }) {
  const updateField = useSetAtom(updateFieldAtom);
  const config = FIELD_TYPE_CONFIG[field.type];
  const confidenceBadge = getConfidenceBadge(config.aiConfidence);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{field.name}</span>
          {field.isRequired && (
            <span className="text-destructive text-xs">*</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{config.label}</span>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {field.slug}
        </code>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={config.aiConfidence} className="w-16 h-2" />
          <Badge variant={confidenceBadge.variant} className="text-xs">
            {config.aiConfidence}%
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        {config.aiWarning ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px]">{config.aiWarning}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={field.isAiExtractable}
          onCheckedChange={(checked) =>
            updateField(field.id, { isAiExtractable: checked })
          }
          disabled={!config.aiExtractable}
        />
      </TableCell>
    </TableRow>
  );
}

export function AIConfigStep() {
  const state = useAtomValue(formBuilderAtom);
  const aiFields = useAtomValue(aiExtractableFieldsAtom);
  const allSortedFields = useAtomValue(sortedFieldsAtom);
  const updateField = useSetAtom(updateFieldAtom);
  const [activeTab, setActiveTab] = useState("config");

  const allFields = state.fields;
  const extractableFields = allFields.filter(
    (f) => FIELD_TYPE_CONFIG[f.type].aiExtractable
  );
  const nonExtractableFields = allFields.filter(
    (f) => !FIELD_TYPE_CONFIG[f.type].aiExtractable
  );
  const enabledCount = aiFields.length;

  // Calculate average confidence of enabled fields
  const avgConfidence =
    aiFields.length > 0
      ? Math.round(
          aiFields.reduce(
            (acc, f) => acc + FIELD_TYPE_CONFIG[f.type].aiConfidence,
            0
          ) / aiFields.length
        )
      : 0;

  const enableAllExtractable = () => {
    extractableFields.forEach((field) => {
      if (!field.isAiExtractable) {
        updateField(field.id, { isAiExtractable: true });
      }
    });
  };

  const disableAllExtractable = () => {
    extractableFields.forEach((field) => {
      if (field.isAiExtractable) {
        updateField(field.id, { isAiExtractable: false });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2" disabled={!state.form.id}>
            <FlaskConical className="h-4 w-4" />
            Test Extraction
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-6">
          {/* Overview */}
          <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI-Enabled Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enabledCount} / {extractableFields.length}
            </div>
            <p className="text-xs text-muted-foreground">
              fields will be extracted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getConfidenceColor(avgConfidence)}`}>
              {avgConfidence}%
            </div>
            <p className="text-xs text-muted-foreground">
              expected extraction accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Manual Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nonExtractableFields.length + (extractableFields.length - enabledCount)}
            </div>
            <p className="text-xs text-muted-foreground">
              require manual entry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How AI Extraction Works</p>
            <p className="text-sm text-blue-700 mt-1">
              When a client call is transcribed, our AI (Claude Haiku) will
              analyze the transcript and attempt to fill in enabled fields
              automatically. Fields with low confidence or ambiguous data will
              be flagged for human review.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Fields Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Extraction Configuration
              </CardTitle>
              <CardDescription>
                Choose which fields should be automatically extracted from call
                transcripts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={enableAllExtractable}
                className="text-xs text-primary hover:underline"
              >
                Enable all
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={disableAllExtractable}
                className="text-xs text-muted-foreground hover:underline"
              >
                Disable all
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {extractableFields.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Confidence
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[200px]">
                              Expected accuracy of AI extraction based on field
                              type. Higher is better.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractableFields.map((field) => (
                  <AIFieldRow key={field.id} field={field} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No extractable fields in this form.</p>
              <p className="text-sm">
                Add fields in the Fields step to configure AI extraction.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

          {/* Non-extractable fields notice */}
          {nonExtractableFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  Manual-Only Fields
                </CardTitle>
                <CardDescription>
                  These field types cannot be extracted from audio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {nonExtractableFields.map((field) => (
                    <Badge key={field.id} variant="outline">
                      {field.name} ({FIELD_TYPE_CONFIG[field.type].label})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="test" className="mt-6">
          {state.form.id ? (
            <ExtractionTester formId={state.form.id} fields={allSortedFields} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Save your form first to test AI extraction.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &ldquo;Save Draft&rdquo; in the header to save your form.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
