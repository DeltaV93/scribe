"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  FileText,
} from "lucide-react";
import type { FormFieldData } from "@/types";

interface ExtractionResult {
  success: boolean;
  fields: Array<{
    fieldId: string;
    slug: string;
    value: string | number | boolean | string[] | null;
    confidence: number;
    reasoning?: string;
    sourceSnippet?: string;
    needsReview: boolean;
  }>;
  overallConfidence: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  processingTimeMs: number;
  error?: string;
}

interface ExtractionTesterProps {
  formId: string;
  fields: FormFieldData[];
}

export function ExtractionTester({ formId, fields }: ExtractionTesterProps) {
  const [sourceText, setSourceText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const aiExtractableFields = fields.filter((f) => f.isAiExtractable);

  const handleExtract = async () => {
    if (!sourceText.trim()) return;

    setIsExtracting(true);
    setResult(null);

    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formId,
          sourceText,
          options: {
            includeExamples: true,
            strictMode: true,
          },
        }),
      });

      const data = await response.json();
      setResult(data);

      // Auto-expand fields that need review
      if (data.success && data.fields) {
        const needsReviewIds = new Set<string>(
          data.fields
            .filter((f: { needsReview: boolean }) => f.needsReview)
            .map((f: { fieldId: string }) => f.fieldId)
        );
        setExpandedFields(needsReviewIds);
      }
    } catch (error) {
      setResult({
        success: false,
        fields: [],
        overallConfidence: 0,
        tokensUsed: { input: 0, output: 0 },
        processingTimeMs: 0,
        error: "Failed to connect to extraction API",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLearn = async (fieldId: string, extractedResult: ExtractionResult["fields"][0]) => {
    if (!extractedResult.sourceSnippet) return;

    try {
      await fetch("/api/ai/examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "learn",
          fieldId,
          sourceSnippet: extractedResult.sourceSnippet,
          extractedValue: String(extractedResult.value),
        }),
      });
    } catch (error) {
      console.error("Failed to save example:", error);
    }
  };

  const toggleField = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const getFieldName = (fieldId: string) => {
    return fields.find((f) => f.id === fieldId)?.name || fieldId;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Source Text
          </CardTitle>
          <CardDescription>
            Paste a call transcript, document text, or notes to extract form data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your transcript or document text here...

Example:
Agent: Thank you for calling. Can I get your name please?
Caller: Yes, my name is John Smith.
Agent: And what's the best phone number to reach you?
Caller: It's 555-123-4567..."
            rows={8}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {aiExtractableFields.length} AI-extractable fields in this form
            </p>
            <Button
              onClick={handleExtract}
              disabled={!sourceText.trim() || isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                Extraction Results
              </CardTitle>
              {result.success && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Overall Confidence</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={result.overallConfidence}
                      className="w-20 h-2"
                    />
                    <span
                      className={cn(
                        "font-medium",
                        getConfidenceColor(result.overallConfidence)
                      )}
                    >
                      {result.overallConfidence}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            {result.success && (
              <CardDescription>
                Processed in {result.processingTimeMs}ms • {result.tokensUsed.input} input tokens, {result.tokensUsed.output} output tokens
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {result.error ? (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                {result.error}
              </div>
            ) : (
              <div className="space-y-2">
                {result.fields.map((extraction) => (
                  <Collapsible
                    key={extraction.fieldId}
                    open={expandedFields.has(extraction.fieldId)}
                    onOpenChange={() => toggleField(extraction.fieldId)}
                  >
                    <div
                      className={cn(
                        "border rounded-lg",
                        extraction.needsReview && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20"
                      )}
                    >
                      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              expandedFields.has(extraction.fieldId) && "rotate-180"
                            )}
                          />
                          <span className="font-medium text-sm">
                            {getFieldName(extraction.fieldId)}
                          </span>
                          {extraction.needsReview && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                              Needs Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                            {extraction.value === null
                              ? "—"
                              : String(extraction.value)}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              getConfidenceColor(extraction.confidence)
                            )}
                          >
                            {extraction.confidence}%
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 border-t space-y-3">
                          {extraction.reasoning && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Reasoning
                              </p>
                              <p className="text-sm">{extraction.reasoning}</p>
                            </div>
                          )}
                          {extraction.sourceSnippet && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Source
                              </p>
                              <p className="text-sm italic bg-muted/50 p-2 rounded">
                                &ldquo;{extraction.sourceSnippet}&rdquo;
                              </p>
                            </div>
                          )}
                          {extraction.sourceSnippet && extraction.value && (
                            <div className="flex items-center gap-2 pt-2">
                              <span className="text-xs text-muted-foreground">
                                Was this extraction correct?
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleLearn(extraction.fieldId, extraction)}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Yes, learn from this
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                No
                              </Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}

                {result.fields.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No data could be extracted from the source text.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
