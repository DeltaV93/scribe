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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle,
  FlaskConical,
  ArrowRight,
  MessageSquare,
  FileText,
  Zap,
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

/**
 * Example conversation snippet to illustrate AI extraction
 */
const EXAMPLE_TRANSCRIPT = `"Hi, my name is Maria Garcia and I'm calling about getting help with food assistance. I live at 456 Oak Street in Springfield. I have two children and my husband recently lost his job..."`;

const EXAMPLE_EXTRACTED = [
  { field: "Full Name", value: "Maria Garcia", confidence: 95 },
  { field: "Address", value: "456 Oak Street, Springfield", confidence: 88 },
  { field: "Household Size", value: "4", confidence: 75 },
  { field: "Reason for Visit", value: "Food assistance", confidence: 92 },
];

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-help">
                {field.slug}
              </code>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[200px]">
                Internal identifier used by the AI to map extracted data to this field
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <Progress value={config.aiConfidence} className="w-16 h-2" />
                <Badge variant={confidenceBadge.variant} className="text-xs">
                  {config.aiConfidence}%
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[220px]">
                {config.aiConfidence >= 80
                  ? "This field type is highly reliable for AI extraction"
                  : config.aiConfidence >= 60
                  ? "This field type has moderate extraction accuracy. Review recommended."
                  : "This field type has lower extraction accuracy. Manual review strongly recommended."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>No known issues with this field type</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Switch
                  checked={field.isAiExtractable}
                  onCheckedChange={(checked) =>
                    updateField(field.id, { isAiExtractable: checked })
                  }
                  disabled={!config.aiExtractable}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-[200px]">
                {!config.aiExtractable
                  ? "This field type cannot be extracted from audio"
                  : field.isAiExtractable
                  ? "AI will attempt to extract this field from call transcripts"
                  : "This field will require manual entry"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
  const [showExample, setShowExample] = useState(false);

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
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-semibold tracking-tight">AI Extraction Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure how AI extracts data from calls and conversations. These settings help the AI
          understand which fields to populate automatically when processing call transcripts.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Configure Fields
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2" disabled={!state.form.id}>
            <FlaskConical className="h-4 w-4" />
            Test Extraction
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-6">
          {/* Quick Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Auto-Fill Fields
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {enabledCount} / {extractableFields.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  fields will be auto-populated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1.5">
                        Expected Accuracy
                        <HelpCircle className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px]">
                          Average accuracy based on field types. Higher percentages mean more
                          reliable automatic extraction.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getConfidenceColor(avgConfidence)}`}>
                  {avgConfidence}%
                </div>
                <p className="text-xs text-muted-foreground">
                  across enabled fields
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Manual Entry Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {nonExtractableFields.length + (extractableFields.length - enabledCount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  fields need human input
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How It Works - Expandable */}
          <Accordion type="single" collapsible defaultValue="how-it-works">
            <AccordionItem value="how-it-works" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">How does AI extraction work?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">1</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Call Recording</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          When you record a client call, the audio is automatically transcribed to text.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">2</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">AI Analysis</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Our AI reads the transcript and identifies relevant information for each enabled field.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">3</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">Review & Confirm</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Extracted data is pre-filled for your review. Low-confidence items are flagged.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Before/After Example */}
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExample(!showExample)}
                      className="mb-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0 h-auto"
                    >
                      {showExample ? "Hide example" : "See an example of AI extraction"}
                      <ArrowRight className={`h-3.5 w-3.5 ml-1 transition-transform ${showExample ? "rotate-90" : ""}`} />
                    </Button>

                    {showExample && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-muted">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              Call Transcript
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground italic bg-muted/50 p-3 rounded">
                              {EXAMPLE_TRANSCRIPT}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="border-green-200 bg-green-50/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-green-600" />
                              AI Extracted Data
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {EXAMPLE_EXTRACTED.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{item.field}:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.value}</span>
                                    <Badge
                                      variant={item.confidence >= 80 ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {item.confidence}%
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Field Configuration Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    Field Settings
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Enable or disable automatic extraction for each field. The AI will only attempt to
                    extract data for fields with the toggle switched on.
                  </CardDescription>
                </div>
                {extractableFields.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={enableAllExtractable}
                      className="text-xs h-8"
                    >
                      Enable all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={disableAllExtractable}
                      className="text-xs text-muted-foreground h-8"
                    >
                      Disable all
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {extractableFields.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Field ID
                                <HelpCircle className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[200px]">
                                  Technical identifier used internally. You don&apos;t need to
                                  change this.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Accuracy
                                <HelpCircle className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[220px]">
                                  Expected extraction accuracy based on field type. Names and dates
                                  extract reliably; complex text may need review.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Notes
                                <HelpCircle className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[200px]">
                                  Warnings or tips about extracting this field type
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Auto-Extract
                                <HelpCircle className="h-3 w-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[200px]">
                                  When enabled, AI will try to fill this field from the call
                                  transcript. When disabled, manual entry is required.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractableFields.map((field) => (
                        <AIFieldRow key={field.id} field={field} />
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Tip: Start with all fields enabled. You can always disable specific fields later
                    if extraction quality is low.
                  </p>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No extractable fields in this form</p>
                  <p className="text-sm mt-1">
                    Go back to the Fields step and add text, number, or date fields to enable AI
                    extraction.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Non-extractable fields notice */}
          {nonExtractableFields.length > 0 && (
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  Fields Requiring Manual Entry
                </CardTitle>
                <CardDescription>
                  These fields cannot be automatically extracted from audio. They require signatures,
                  file uploads, or other inputs that must be collected directly from the client.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {nonExtractableFields.map((field) => (
                    <TooltipProvider key={field.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help">
                            {field.name}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{FIELD_TYPE_CONFIG[field.type].label} - requires direct input</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-6">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="flex items-start gap-3 pt-4">
              <FlaskConical className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Test Before You Publish</p>
                <p className="text-sm text-blue-700 mt-1">
                  Try the extraction with sample text to see how well the AI identifies and extracts
                  data for your fields. This helps you fine-tune which fields to enable.
                </p>
              </div>
            </CardContent>
          </Card>

          {state.form.id ? (
            <ExtractionTester formId={state.form.id} fields={allSortedFields} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-muted-foreground">
                  Save your form to test extraction
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click &ldquo;Save Draft&rdquo; in the header, then return here to test how AI
                  extracts data from sample text.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
