"use client";

import { useState, useEffect, use } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mic,
  Phone,
  Video,
  Clock,
  User,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TranscriptViewer } from "@/components/conversation/transcript-viewer";
import { SensitivityReview } from "@/components/conversation/sensitivity-review";
import { OutputEditor } from "@/components/conversation/output-editor";
import { EditableTitle } from "@/components/conversation/editable-title";
import { SpeakerLabeler, type SpeakerLabel } from "@/components/conversation/speaker-labeler";
import {
  UnifiedReviewView,
  useExtractionData,
} from "@/components/conversation/unified-review-view";
import {
  ClientSuggestionPanel,
  useClientSuggestions,
} from "@/components/conversation/client-suggestion-panel";
import { cn } from "@/lib/utils";
import { RecordingRecoveryPanel } from "@/components/conversation/recording-recovery-panel";
import type {
  ConversationType,
  ConversationStatus,
  SensitivityTier,
  FlagReviewStatus,
  RecoveryStatus,
} from "@prisma/client";

interface RecordingStatusData {
  hasRecording: boolean;
  presignedUrlValid: boolean;
  lastHeartbeat: string | null;
}

interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  status: ConversationStatus;
  recoveryStatus: RecoveryStatus | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  sensitivityTier: SensitivityTier;
  transcriptRaw: string | null;
  transcriptJson: unknown;
  formIds?: string[];
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  flaggedSegments: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    category: string;
    confidence: number;
    suggestedTier: SensitivityTier;
    status: FlagReviewStatus;
  }>;
  draftedOutputs: Array<{
    id: string;
    outputType: string;
    title: string | null;
    content: string;
    editedContent: string | null;
    metadata: Record<string, unknown> | null;
    sourceSnippet: string | null;
    status: string;
    destinationPlatform: string | null;
    externalId: string | null;
    pushError: string | null;
  }>;
  _count: {
    flaggedSegments: number;
    draftedOutputs: number;
    accessList: number;
  };
}

const TYPE_ICONS: Record<ConversationType, React.ReactNode> = {
  PHONE_CALL: <Phone className="h-5 w-5" />,
  IN_PERSON: <Mic className="h-5 w-5" />,
  VIDEO_MEETING: <Video className="h-5 w-5" />,
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Forms tab content with extraction and client suggestion
function FormsTabContent({
  conversationId,
  hasTranscript,
}: {
  conversationId: string;
  hasTranscript: boolean;
}) {
  const {
    isLoading: isExtractionLoading,
    extractionData,
    forms,
    runExtraction,
  } = useExtractionData(conversationId);

  const {
    isLoading: isSuggestionsLoading,
    error: suggestionsError,
    suggestions,
    extractedPII,
    fetchSuggestions,
  } = useClientSuggestions(conversationId);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const handleFinalize = async (edits: Record<string, Record<string, unknown>>) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits,
          clientId: selectedClientId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to finalize");
      }

      toast.success(`Created ${data.submissions.length} form submission(s)`);
    } catch (error) {
      console.error("Finalize error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to finalize");
    }
  };

  if (!hasTranscript) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Transcript required for form extraction. Wait for processing to complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Review View */}
      <UnifiedReviewView
        conversationId={conversationId}
        extractionData={extractionData}
        forms={forms}
        isLoading={isExtractionLoading}
        onExtract={runExtraction}
        onFinalize={handleFinalize}
      />

      {/* Client Suggestion Panel */}
      <ClientSuggestionPanel
        conversationId={conversationId}
        suggestions={suggestions}
        extractedPII={extractedPII}
        isLoading={isSuggestionsLoading}
        error={suggestionsError}
        onSuggest={fetchSuggestions}
        onSelect={(clientId) => setSelectedClientId(clientId)}
        onCreateNew={() => {
          // Could open a modal to create new client
          window.open("/clients/new", "_blank");
        }}
      />
    </div>
  );
}

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [canEditTitle, setCanEditTitle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("outputs");
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatusData | null>(null);
  const [speakerLabels, setSpeakerLabels] = useState<SpeakerLabel[]>([]);

  useEffect(() => {
    fetchConversation();
  }, [id]);

  // Fetch recording status when conversation is stuck in RECORDING with recoveryStatus
  useEffect(() => {
    if (conversation?.status === "RECORDING" && conversation?.recoveryStatus) {
      fetchRecordingStatus();
    }
  }, [conversation?.id, conversation?.status, conversation?.recoveryStatus]);

  // Fetch speaker labels when conversation has a transcript
  useEffect(() => {
    if (conversation?.transcriptJson) {
      fetchSpeakerLabels();
    }
  }, [conversation?.id, !!conversation?.transcriptJson]);

  // Poll for status updates when conversation is PROCESSING
  useEffect(() => {
    if (conversation?.status !== "PROCESSING") return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/conversations/${id}`);
        const data = await response.json();
        if (data.success && data.conversation.status !== "PROCESSING") {
          setConversation(data.conversation);
          setCanEditTitle(data.canEditTitle ?? false);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [conversation?.status, id]);

  const fetchRecordingStatus = async () => {
    try {
      const response = await fetch(`/api/conversations/${id}/recording-status`);
      const data = await response.json();
      if (data.success) {
        setRecordingStatus({
          hasRecording: data.hasRecording,
          presignedUrlValid: data.presignedUrlValid,
          lastHeartbeat: data.lastHeartbeat,
        });
      }
    } catch (error) {
      console.error("Failed to fetch recording status:", error);
    }
  };

  const fetchSpeakerLabels = async () => {
    try {
      const response = await fetch(`/api/conversations/${id}/speakers`);
      const data = await response.json();
      if (response.ok && data.labels) {
        setSpeakerLabels(data.labels);
      }
    } catch (error) {
      console.error("Failed to fetch speaker labels:", error);
    }
  };

  const fetchConversation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json();

      if (data.success) {
        setConversation(data.conversation);
        setCanEditTitle(data.canEditTitle ?? false);

        // Auto-select review tab if there are pending items
        const pendingFlags = data.conversation.flaggedSegments.filter(
          (s: { status: string }) => s.status === "PENDING"
        ).length;
        if (pendingFlags > 0) {
          setActiveTab("review");
        }
      }
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReprocessing = async () => {
    try {
      await fetch(`/api/conversations/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reprocess: true }),
      });
      fetchConversation();
    } catch (error) {
      console.error("Failed to reprocess:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/conversations");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleReviewSegment = async (
    segmentId: string,
    decision: FlagReviewStatus,
    finalTier?: SensitivityTier,
    notes?: string
  ) => {
    await fetch(`/api/conversations/${id}/flagged-segments/${segmentId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, finalTier, notes }),
    });
    fetchConversation();
  };

  const handleUpdateOutput = async (
    outputId: string,
    data: { title?: string; content?: string }
  ) => {
    await fetch(`/api/conversations/${id}/outputs/${outputId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchConversation();
  };

  const handleApproveOutput = async (outputId: string) => {
    const response = await fetch(`/api/conversations/${id}/outputs/${outputId}/approve`, {
      method: "POST",
    });
    if (response.ok) {
      // Optimistic update - update local state without full refresh
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              draftedOutputs: prev.draftedOutputs.map((output) =>
                output.id === outputId
                  ? { ...output, status: "APPROVED" }
                  : output
              ),
            }
          : null
      );
    }
  };

  const handleRejectOutput = async (outputId: string) => {
    const response = await fetch(`/api/conversations/${id}/outputs/${outputId}/reject`, {
      method: "POST",
    });
    if (response.ok) {
      // Optimistic update
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              draftedOutputs: prev.draftedOutputs.map((output) =>
                output.id === outputId
                  ? { ...output, status: "REJECTED" }
                  : output
              ),
            }
          : null
      );
    }
  };

  const handlePushOutput = async (outputId: string) => {
    const response = await fetch(`/api/conversations/${id}/outputs/${outputId}/push`, {
      method: "POST",
    });
    if (response.ok) {
      // Optimistic update
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              draftedOutputs: prev.draftedOutputs.map((output) =>
                output.id === outputId
                  ? { ...output, status: "PUSHED" }
                  : output
              ),
            }
          : null
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <p>Conversation not found</p>
            <Button className="mt-4" onClick={() => router.push("/conversations")}>
              Back to Conversations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingFlags = conversation.flaggedSegments.filter(
    (s) => s.status === "PENDING"
  ).length;
  const pendingOutputs = conversation.draftedOutputs.filter(
    (o) => o.status === "PENDING"
  ).length;

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {TYPE_ICONS[conversation.type]}
            </div>
            <div>
              <EditableTitle
                conversationId={conversation.id}
                title={conversation.title}
                canEdit={canEditTitle}
                onTitleUpdate={(newTitle) => {
                  setConversation((prev) =>
                    prev ? { ...prev, title: newTitle } : null
                  );
                }}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{conversation.createdBy.name || conversation.createdBy.email}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{formatDuration(conversation.durationSeconds)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={conversation.status === "COMPLETED" ? "secondary" : "default"}
          >
            {conversation.status}
          </Badge>
          {conversation.sensitivityTier !== "STANDARD" && (
            <Badge
              variant="outline"
              className={cn(
                conversation.sensitivityTier === "RESTRICTED"
                  ? "border-amber-500 text-amber-600"
                  : "border-red-500 text-red-600"
              )}
            >
              {conversation.sensitivityTier}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleReprocessing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocess
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Processing status */}
      {conversation.status === "PROCESSING" && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Processing recording... This may take a few minutes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recording recovery panel for stuck recordings */}
      {conversation.status === "RECORDING" && conversation.recoveryStatus && recordingStatus && (
        <RecordingRecoveryPanel
          conversationId={conversation.id}
          recoveryStatus={conversation.recoveryStatus}
          hasRecording={recordingStatus.hasRecording}
          lastHeartbeat={recordingStatus.lastHeartbeat}
          startedAt={conversation.startedAt}
          durationSeconds={conversation.durationSeconds}
          presignedUrlValid={recordingStatus.presignedUrlValid}
          onRecoveryComplete={fetchConversation}
        />
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Outputs and Review */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="outputs" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Outputs
                {pendingOutputs > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {pendingOutputs}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="review" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Review
                {pendingFlags > 0 && (
                  <Badge variant="default" className="ml-1 bg-amber-500">
                    {pendingFlags}
                  </Badge>
                )}
              </TabsTrigger>
              {conversation.type === "IN_PERSON" && !!conversation.transcriptJson && (
                <TabsTrigger value="speakers" className="gap-2">
                  <Users className="h-4 w-4" />
                  Speakers
                </TabsTrigger>
              )}
              {(conversation.formIds?.length ?? 0) > 0 && (
                <TabsTrigger value="forms" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Forms
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="outputs" className="mt-4">
              <OutputEditor
                outputs={conversation.draftedOutputs as never[]}
                onUpdate={handleUpdateOutput}
                onApprove={handleApproveOutput}
                onReject={handleRejectOutput}
                onPush={handlePushOutput}
              />
            </TabsContent>

            <TabsContent value="review" className="mt-4">
              <SensitivityReview
                segments={conversation.flaggedSegments as never[]}
                onReview={handleReviewSegment}
              />
            </TabsContent>

            {conversation.type === "IN_PERSON" && (
              <TabsContent value="speakers" className="mt-4">
                <SpeakerLabeler
                  conversationId={conversation.id}
                  onLabelsChange={(labels) => setSpeakerLabels(labels)}
                />
              </TabsContent>
            )}

            {(conversation.formIds?.length ?? 0) > 0 && (
              <TabsContent value="forms" className="mt-4">
                <FormsTabContent
                  conversationId={conversation.id}
                  hasTranscript={!!conversation.transcriptRaw}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Right: Transcript */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {conversation.transcriptJson ? (
                <TranscriptViewer
                  segments={conversation.transcriptJson as never[]}
                  flaggedSegments={conversation.flaggedSegments as never[]}
                  speakerLabels={speakerLabels}
                  className="max-h-[600px] overflow-y-auto"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {conversation.status === "PROCESSING"
                    ? "Transcript will appear here once processing is complete."
                    : "No transcript available."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
