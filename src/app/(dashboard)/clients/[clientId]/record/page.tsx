"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  Loader2,
  Mic,
  Upload,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  RecordingConsent,
  AudioRecorder,
  RecordingDetail,
} from "@/components/in-person-recording";
import type { ConsentMethod } from "@/components/in-person-recording";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

type Step = "consent" | "record" | "upload" | "review";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Form {
  id: string;
  name: string;
  type: string;
}

interface Recording {
  id: string;
  createdAt: string;
  duration: number | null;
  transcriptText: string | null;
  extractedData: Record<string, unknown> | null;
  confidenceScores: Record<string, number> | null;
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  processingError: string | null;
  consentMethod: "DIGITAL" | "VERBAL" | "PRE_SIGNED";
  consentRecordedAt: string;
  formIds: string[];
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  playbackUrl?: string | null;
}

const stepLabels: Record<Step, { title: string; description: string }> = {
  consent: {
    title: "Capture Consent",
    description: "Obtain client consent for recording",
  },
  record: {
    title: "Record Meeting",
    description: "Record your in-person meeting",
  },
  upload: {
    title: "Upload & Process",
    description: "Uploading and processing recording",
  },
  review: {
    title: "Review",
    description: "Review transcript and extracted data",
  },
};

export default function RecordClientPage({ params }: PageProps) {
  const { clientId } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<Step>("consent");
  const [client, setClient] = useState<Client | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recording state
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);

  // Consent state
  const [consentData, setConsentData] = useState<{
    method: ConsentMethod;
    signature?: string;
    documentId?: string;
    acknowledgedAt: Date;
  } | null>(null);

  // Fetch client and forms
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch client
        const clientRes = await fetch(`/api/clients/${clientId}`);
        if (!clientRes.ok) throw new Error("Failed to fetch client");
        const clientData = await clientRes.json();
        setClient(clientData.data);

        // Fetch forms for extraction
        const formsRes = await fetch("/api/forms?status=PUBLISHED&limit=50");
        if (!formsRes.ok) throw new Error("Failed to fetch forms");
        const formsData = await formsRes.json();
        setForms(formsData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  // Handle consent completion
  const handleConsentComplete = async (consent: {
    method: ConsentMethod;
    signature?: string;
    documentId?: string;
    acknowledgedAt: Date;
  }) => {
    setConsentData(consent);

    try {
      // Create recording record
      const res = await fetch("/api/in-person-recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          consentMethod: consent.method,
          consentSignature: consent.signature,
          consentDocumentId: consent.documentId,
          formIds: selectedFormId ? [selectedFormId] : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create recording");
      }

      const data = await res.json();
      setRecordingId(data.data.id);
      setStep("record");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recording");
    }
  };

  // Handle recording completion
  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setAudioBlob(blob);
    setAudioDuration(duration);
    uploadRecording(blob, duration);
  };

  // Upload recording
  const uploadRecording = async (blob: Blob, duration: number) => {
    if (!recordingId) return;

    setStep("upload");
    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("duration", String(duration));

      setUploadProgress(30);

      const uploadRes = await fetch(
        `/api/in-person-recordings/${recordingId}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error?.message || "Failed to upload recording");
      }

      setUploadProgress(60);
      setIsUploading(false);

      // Trigger processing
      await processRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload recording");
      setIsUploading(false);
    }
  };

  // Process recording
  const processRecording = async () => {
    if (!recordingId) return;

    setIsProcessing(true);
    setUploadProgress(80);

    try {
      const processRes = await fetch(
        `/api/in-person-recordings/${recordingId}/process`,
        { method: "POST" }
      );

      if (!processRes.ok) {
        const data = await processRes.json();
        throw new Error(data.error?.message || "Failed to process recording");
      }

      setUploadProgress(100);

      // Fetch completed recording
      await fetchRecording();
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process recording");
    } finally {
      setIsProcessing(false);
    }
  };

  // Fetch recording details
  const fetchRecording = async () => {
    if (!recordingId) return;

    try {
      const res = await fetch(`/api/in-person-recordings/${recordingId}`);
      if (!res.ok) throw new Error("Failed to fetch recording");
      const data = await res.json();
      setRecording(data.data);
    } catch (err) {
      console.error("Error fetching recording:", err);
    }
  };

  // Retry processing
  const handleRetryProcess = async () => {
    await processRecording();
    await fetchRecording();
  };

  // Get step index for progress
  const steps: Step[] = ["consent", "record", "upload", "review"];
  const currentStepIndex = steps.indexOf(step);
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => {
                setError(null);
                router.refresh();
              }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/clients">Back to Clients</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/clients/${clientId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            Record Meeting with {client.firstName} {client.lastName}
          </h1>
          <p className="text-muted-foreground">
            {stepLabels[step].description}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => {
            const isComplete = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const Icon =
              s === "consent"
                ? FileText
                : s === "record"
                  ? Mic
                  : s === "upload"
                    ? Upload
                    : Check;

            return (
              <div
                key={s}
                className="flex items-center gap-2"
              >
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full
                    ${isComplete ? "bg-green-500 text-white" : ""}
                    ${isCurrent ? "bg-primary text-primary-foreground" : ""}
                    ${!isComplete && !isCurrent ? "bg-muted text-muted-foreground" : ""}
                  `}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`
                    text-sm hidden sm:block
                    ${isCurrent ? "font-medium" : "text-muted-foreground"}
                  `}
                >
                  {stepLabels[s].title}
                </span>
              </div>
            );
          })}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Form Selection (before consent) */}
      {step === "consent" && forms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Form for Extraction</CardTitle>
            <CardDescription>
              Choose a form to extract data from the conversation (optional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a form (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No form - transcript only</SelectItem>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      {step === "consent" && (
        <RecordingConsent
          clientName={`${client.firstName} ${client.lastName}`}
          onConsentComplete={handleConsentComplete}
          onCancel={() => router.back()}
        />
      )}

      {step === "record" && (
        <div className="space-y-4">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDurationMinutes={60}
          />
          <p className="text-center text-sm text-muted-foreground">
            {consentData?.method === "VERBAL" && (
              "Remember: Have the client state their consent at the beginning of the recording."
            )}
          </p>
        </div>
      )}

      {step === "upload" && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              {isUploading ? (
                <>
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
                  <p className="text-lg font-medium">Uploading recording...</p>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                  <p className="text-lg font-medium">Processing recording...</p>
                  <p className="text-sm text-muted-foreground">
                    Transcribing audio and extracting data. This may take a few minutes.
                  </p>
                </>
              ) : null}
              <Progress value={uploadProgress} className="max-w-xs mx-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && recording && (
        <RecordingDetail
          recording={recording}
          onProcess={processRecording}
          onRetry={handleRetryProcess}
          isProcessing={isProcessing}
        />
      )}

      {/* Navigation */}
      {step === "review" && (
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/clients/${clientId}`}>
              Back to Client
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/clients/${clientId}/record`}>
              New Recording
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
