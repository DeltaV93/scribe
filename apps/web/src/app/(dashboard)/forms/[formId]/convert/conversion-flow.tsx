"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileImage,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DocumentUploadDialog, ExtractionReview } from "@/components/document-extraction"

interface FormField {
  id: string
  name: string
  type: string
  isRequired: boolean
}

interface ConversionFlowProps {
  formId: string
  formName: string
  fields: FormField[]
  clientId?: string
  clientName?: string
}

type FlowStep = "upload" | "review" | "complete"

export function ConversionFlow({
  formId,
  formName,
  fields,
  clientId,
  clientName,
}: ConversionFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>("upload")
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)

  const handleUploadComplete = (id: string) => {
    setExtractionId(id)
    setStep("review")
  }

  const handleApply = (subId: string) => {
    setSubmissionId(subId)
    setStep("complete")
  }

  const handleCancel = () => {
    setExtractionId(null)
    setStep("upload")
  }

  const handleGoToSubmission = () => {
    if (submissionId) {
      router.push(`/forms/${formId}/submissions/${submissionId}`)
    }
  }

  const handleNewConversion = () => {
    setExtractionId(null)
    setSubmissionId(null)
    setStep("upload")
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <StepIndicator
          step={1}
          label="Upload"
          active={step === "upload"}
          completed={step === "review" || step === "complete"}
        />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator
          step={2}
          label="Review"
          active={step === "review"}
          completed={step === "complete"}
        />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator
          step={3}
          label="Complete"
          active={step === "complete"}
          completed={false}
        />
      </div>

      {/* Upload step */}
      {step === "upload" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a photo or PDF of a filled-out form to extract data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Form:</span>{" "}
                <span className="font-medium">{formName}</span>
              </p>
              {clientName && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Client:</span>{" "}
                  <span className="font-medium">{clientName}</span>
                </p>
              )}
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Extractable fields:</span>{" "}
                <span className="font-medium">{fields.length}</span>
              </p>
            </div>

            {/* Upload options */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowUploadDialog(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileImage className="h-10 w-10 text-blue-500" />
                <div className="text-center">
                  <p className="font-medium">Photo</p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, HEIC
                  </p>
                </div>
              </button>

              <button
                onClick={() => setShowUploadDialog(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileText className="h-10 w-10 text-red-500" />
                <div className="text-center">
                  <p className="font-medium">PDF</p>
                  <p className="text-xs text-muted-foreground">
                    Scanned or native
                  </p>
                </div>
              </button>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                How it works:
              </p>
              <ol className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1 list-decimal list-inside">
                <li>Upload a photo or PDF of the filled-out form</li>
                <li>AI extracts text and maps values to form fields</li>
                <li>Review and correct any extracted values</li>
                <li>Apply to create a new form submission</li>
              </ol>
            </div>

            <div className="flex justify-center">
              <Button size="lg" onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-5 w-5 mr-2" />
                Select File to Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review step */}
      {step === "review" && extractionId && (
        <ExtractionReview
          extractionId={extractionId}
          formId={formId}
          onApply={handleApply}
          onCancel={handleCancel}
        />
      )}

      {/* Complete step */}
      {step === "complete" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle>Extraction Complete!</CardTitle>
            <CardDescription>
              The extracted data has been saved as a new form submission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Submission ID</p>
              <p className="font-mono text-sm">{submissionId}</p>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleNewConversion}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Convert Another
              </Button>
              <Button onClick={handleGoToSubmission}>
                View Submission
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload dialog */}
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        formId={formId}
        formName={formName}
        clientId={clientId}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number
  label: string
  active: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium
          ${
            completed
              ? "bg-green-600 text-white"
              : active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }
        `}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span
        className={`text-sm ${
          active || completed ? "font-medium" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  )
}
