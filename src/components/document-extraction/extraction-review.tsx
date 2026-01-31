"use client"

import { useState, useEffect } from "react"
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FieldMappingEditor } from "./field-mapping"

interface ExtractedField {
  fieldId: string
  fieldSlug: string
  fieldName: string
  fieldType: string
  value: string | number | boolean | string[] | null
  rawValue: string | null
  confidence: number
  reasoning?: string
  sourceSnippet?: string
  needsReview: boolean
  validationErrors: string[]
}

interface ExtractionResult {
  documentText?: string
  pageCount?: number
  isScanned?: boolean
  extractedFields?: ExtractedField[]
  overallConfidence?: number
  warnings?: string[]
  summary?: {
    totalFields: number
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    averageConfidence: number
    fieldsNeedingReview: number
    validationErrors: number
  }
}

interface ExtractionReviewProps {
  extractionId: string
  formId: string
  onApply: (submissionId: string) => void
  onCancel: () => void
}

export function ExtractionReview({
  extractionId,
  formId,
  onApply,
  onCancel,
}: ExtractionReviewProps) {
  const [status, setStatus] = useState<string>("PENDING")
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [showDocumentText, setShowDocumentText] = useState(false)

  // Poll for status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/document-extraction/${extractionId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch status")
        }

        const data = await response.json()
        setStatus(data.status)
        setProgress(data.progress)

        if (data.result) {
          setResult(data.result)
        }

        if (data.error) {
          setError(data.error)
        }

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(pollInterval)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        clearInterval(pollInterval)
      }
    }

    pollStatus()
    pollInterval = setInterval(pollStatus, 2000)

    return () => clearInterval(pollInterval)
  }, [extractionId])

  const handleApply = async () => {
    setIsApplying(true)
    try {
      const response = await fetch(
        `/api/document-extraction/${extractionId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minConfidence: 0 }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to apply extraction")
      }

      const data = await response.json()
      onApply(data.submissionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply")
    } finally {
      setIsApplying(false)
    }
  }

  const handleFieldUpdate = async (
    fieldId: string,
    value: string | number | boolean | string[] | null
  ) => {
    try {
      const response = await fetch(
        `/api/document-extraction/${extractionId}/fields`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldId, value, confidence: 1.0 }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to update field")
      }

      const data = await response.json()

      // Update local state
      if (result?.extractedFields) {
        const updatedFields = result.extractedFields.map((f) =>
          f.fieldId === fieldId ? data.field : f
        )
        setResult({ ...result, extractedFields: updatedFields })
      }

      setEditingField(null)
    } catch (err) {
      console.error("Update failed:", err)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return "text-green-600"
    if (confidence >= 0.7) return "text-yellow-600"
    return "text-red-600"
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return <Badge className="bg-green-100 text-green-700">High</Badge>
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
    }
    return <Badge className="bg-red-100 text-red-700">Low</Badge>
  }

  if (status === "PENDING" || status === "PROCESSING") {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Extracting Data...
          </CardTitle>
          <CardDescription>
            AI is analyzing your document and extracting form data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {progress}% complete
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status === "FAILED" || error) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Extraction Failed
          </CardTitle>
          <CardDescription>{error || "An unknown error occurred"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const summary = result?.summary
  const fields = result?.extractedFields || []

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Extraction Complete
            </span>
            {summary && (
              <span
                className={cn(
                  "text-2xl font-bold",
                  getConfidenceColor(summary.averageConfidence)
                )}
              >
                {Math.round(summary.averageConfidence * 100)}%
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {result?.pageCount} page(s) analyzed
            {result?.isScanned && " (scanned document)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <p className="text-2xl font-bold text-green-600">
                  {summary.highConfidence}
                </p>
                <p className="text-xs text-green-700">High Confidence</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                <p className="text-2xl font-bold text-yellow-600">
                  {summary.mediumConfidence}
                </p>
                <p className="text-xs text-yellow-700">Needs Review</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <p className="text-2xl font-bold text-red-600">
                  {summary.lowConfidence}
                </p>
                <p className="text-xs text-red-700">Low Confidence</p>
              </div>
            </div>
          )}

          {result?.warnings && result.warnings.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200">
              <p className="text-sm font-medium text-yellow-700">Warnings:</p>
              <ul className="text-sm text-yellow-600 list-disc list-inside">
                {result.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Extracted Fields</CardTitle>
          <CardDescription>
            Review and correct extracted values before applying
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map((field) => (
            <Collapsible
              key={field.fieldId}
              open={expandedField === field.fieldId}
              onOpenChange={() =>
                setExpandedField(
                  expandedField === field.fieldId ? null : field.fieldId
                )
              }
            >
              <div
                className={cn(
                  "rounded-lg border p-3",
                  field.needsReview && "border-yellow-300 bg-yellow-50/50",
                  field.validationErrors.length > 0 &&
                    "border-red-300 bg-red-50/50"
                )}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {field.needsReview ? (
                        <HelpCircle className="h-4 w-4 text-yellow-500" />
                      ) : field.validationErrors.length > 0 ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium text-sm">
                        {field.fieldName}
                      </span>
                      {getConfidenceBadge(field.confidence)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {field.value !== null
                          ? String(field.value)
                          : "(no value)"}
                      </span>
                      {expandedField === field.fieldId ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3 mt-3 border-t">
                  {editingField === field.fieldId ? (
                    <FieldMappingEditor
                      field={field}
                      onSave={(value) => handleFieldUpdate(field.fieldId, value)}
                      onCancel={() => setEditingField(null)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Extracted Value:
                          </p>
                          <p className="text-sm font-mono bg-muted p-2 rounded mt-1">
                            {field.value !== null
                              ? JSON.stringify(field.value)
                              : "null"}
                          </p>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingField(field.fieldId)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit value</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {field.rawValue && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Raw Text from Document:
                          </p>
                          <p className="text-sm italic text-muted-foreground">
                            &quot;{field.rawValue}&quot;
                          </p>
                        </div>
                      )}

                      {field.reasoning && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            AI Reasoning:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {field.reasoning}
                          </p>
                        </div>
                      )}

                      {field.sourceSnippet && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Source Text:
                          </p>
                          <p className="text-xs font-mono bg-muted p-2 rounded">
                            {field.sourceSnippet}
                          </p>
                        </div>
                      )}

                      {field.validationErrors.length > 0 && (
                        <div className="text-red-600 text-sm">
                          {field.validationErrors.map((err, i) => (
                            <p key={i}>- {err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Document Text */}
      <Collapsible open={showDocumentText} onOpenChange={setShowDocumentText}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Document Text
              </CardTitle>
              {showDocumentText ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded-lg max-h-96 overflow-auto">
                {result?.documentText || "No text extracted"}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Actions */}
      <div className="flex justify-end gap-3 sticky bottom-0 bg-background py-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleApply} disabled={isApplying}>
          {isApplying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply to Form Submission
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
