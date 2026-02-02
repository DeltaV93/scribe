"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  ListChecks,
  HelpCircle,
  Mail,
  FileText,
  RefreshCw,
  File,
  X,
  Calendar,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { UserPicker, AssignToMeButton } from "@/components/meetings/user-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TranscriptSegment {
  speakerId: string;
  speakerName: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface ActionItem {
  id: string;
  description: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assigneeUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  dueDate: string | null;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  contextSnippet: string | null;
}

interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  orgId: string;
  role: string;
}

interface Question {
  id: string;
  question: string;
  askedByName: string | null;
  isAnswered: boolean;
  answer: string | null;
  answeredByName: string | null;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  status: "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
  source: "UPLOAD" | "TEAMS" | "ZOOM" | "GOOGLE_MEET";
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  durationSeconds: number | null;
  participantCount: number | null;
  participants: Array<{ name: string; email?: string }> | null;
  tags: string[];
  processingError: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  transcript: {
    id: string;
    fullText: string;
    segments: TranscriptSegment[];
    wordCount: number;
    language: string;
  } | null;
  summary: {
    id: string;
    executiveSummary: string;
    keyPoints: Array<{ point: string; speakerName?: string }>;
    decisions: Array<{ decision: string; context?: string }>;
    topicsDiscussed: string[];
  } | null;
  actionItems: ActionItem[];
  questions: Question[];
}

const statusConfig = {
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-800", icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-yellow-100 text-yellow-800", icon: Loader2 },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Resend email dialog
  const [isResendOpen, setIsResendOpen] = useState(false);
  const [resendEmails, setResendEmails] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Current user state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Action item update state
  const [updatingActionItemId, setUpdatingActionItemId] = useState<string | null>(null);

  const fetchMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}`);
      if (response.ok) {
        const data = await response.json();
        setMeeting(data.data);
      } else {
        router.push("/meetings");
      }
    } catch (error) {
      console.error("Error fetching meeting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch current user on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/users/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.data);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchMeeting();
    // Poll for updates if processing
    const interval = setInterval(() => {
      if (meeting?.status === "PROCESSING") {
        fetchMeeting();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);

  // File dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (rejectedFiles && Array.isArray(rejectedFiles) && rejectedFiles.length > 0) {
      setUploadError("Invalid file type. Please upload MP3, MP4, WAV, WebM, or M4A files.");
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const maxSize = 500 * 1024 * 1024; // 500MB

      if (file.size > maxSize) {
        setUploadError("File is too large. Maximum size is 500MB.");
        return;
      }

      setSelectedFile(file);
      setUploadError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "audio/webm": [".webm"],
      "audio/m4a": [".m4a"],
      "audio/x-m4a": [".m4a"],
      "audio/mp4": [".m4a"],
      "video/mp4": [".mp4"],
      "video/webm": [".webm"],
      "video/quicktime": [".mov"],
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState("uploading");
    setUploadProgress(10);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("autoProcess", "true");

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 45));
      }, 200);

      const response = await fetch(`/api/meetings/${meetingId}/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(50);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Upload failed");
      }

      const data = await response.json();

      if (data.data?.processing) {
        // File uploaded, now processing
        setUploadState("processing");
        setUploadProgress(60);

        // Poll for completion
        await pollForProcessingComplete(data.data.jobProgressId);
      } else {
        // Just uploaded, not auto-processing
        setUploadState("success");
        setUploadProgress(100);
      }
    } catch (err) {
      setUploadState("error");
      setUploadError(err instanceof Error ? err.message : "An error occurred during upload");
    }
  };

  const pollForProcessingComplete = async (jobProgressId: string) => {
    const maxAttempts = 120; // 4 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      try {
        // Check meeting status directly
        const response = await fetch(`/api/meetings/${meetingId}`);
        if (!response.ok) continue;

        const data = await response.json();
        const status = data.data?.status;

        // Update progress based on status
        if (status === "PROCESSING") {
          setUploadProgress(60 + Math.min(attempts * 0.5, 35));
        }

        if (status === "COMPLETED") {
          setUploadState("success");
          setUploadProgress(100);
          fetchMeeting();
          return;
        }

        if (status === "FAILED") {
          throw new Error(data.data?.processingError || "Processing failed");
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          throw new Error("Processing timed out. Please check back later.");
        }
      }
    }

    throw new Error("Processing timed out. Please check back later.");
  };

  const resetUploadDialog = () => {
    setUploadState("idle");
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  const closeUploadDialog = () => {
    setIsUploadOpen(false);
    // Reset after dialog closes
    setTimeout(resetUploadDialog, 300);
  };

  // Resend error state
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResendEmail = async () => {
    const emails = resendEmails.split(",").map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return;

    setIsResending(true);
    setResendError(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/resend-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmails: emails }),
      });

      if (response.ok) {
        setIsResendOpen(false);
        setResendEmails("");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setResendError(errorData.error?.message || "Failed to send email. Please try again.");
      }
    } catch (error) {
      console.error("Error resending email:", error);
      setResendError("Unable to connect to the server. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Action item error state
  const [actionItemError, setActionItemError] = useState<string | null>(null);
  const [actionItemSuccess, setActionItemSuccess] = useState<string | null>(null);

  const handleActionItemToggle = async (actionItemId: string, currentStatus: string) => {
    const newStatus = currentStatus === "COMPLETED" ? "OPEN" : "COMPLETED";
    setActionItemError(null);
    setActionItemSuccess(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/action-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setActionItemError(errorData.error?.message || "Failed to update action item");
        return;
      }
      fetchMeeting();
    } catch (error) {
      console.error("Error updating action item:", error);
      setActionItemError("Failed to update action item. Please try again.");
    }
  };

  const handleActionItemAssign = async (
    actionItemId: string,
    assigneeUserId: string | null,
    assigneeName?: string | null
  ) => {
    setUpdatingActionItemId(actionItemId);
    setActionItemError(null);
    setActionItemSuccess(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/action-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, assigneeUserId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setActionItemError(errorData.error?.message || "Failed to assign action item");
        return;
      }
      if (assigneeName) {
        setActionItemSuccess(`Assigned to ${assigneeName}`);
        setTimeout(() => setActionItemSuccess(null), 3000);
      } else if (assigneeUserId === null) {
        setActionItemSuccess("Assignment removed");
        setTimeout(() => setActionItemSuccess(null), 3000);
      }
      fetchMeeting();
    } catch (error) {
      console.error("Error assigning action item:", error);
      setActionItemError("Failed to assign action item. Please try again.");
    } finally {
      setUpdatingActionItemId(null);
    }
  };

  const handleActionItemDueDate = async (actionItemId: string, dueDate: string | null) => {
    setUpdatingActionItemId(actionItemId);
    setActionItemError(null);
    setActionItemSuccess(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/action-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, dueDate }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setActionItemError(errorData.error?.message || "Failed to update due date");
        return;
      }
      if (dueDate) {
        setActionItemSuccess("Due date updated");
      } else {
        setActionItemSuccess("Due date removed");
      }
      setTimeout(() => setActionItemSuccess(null), 3000);
      fetchMeeting();
    } catch (error) {
      console.error("Error updating due date:", error);
      setActionItemError("Failed to update due date. Please try again.");
    } finally {
      setUpdatingActionItemId(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-6">
        <p>Meeting not found</p>
      </div>
    );
  }

  const StatusIcon = statusConfig[meeting.status].icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/meetings")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
          {meeting.description && (
            <p className="text-muted-foreground">{meeting.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <Badge className={statusConfig[meeting.status].color}>
              <StatusIcon className={`h-3 w-3 mr-1 ${meeting.status === "PROCESSING" ? "animate-spin" : ""}`} />
              {statusConfig[meeting.status].label}
            </Badge>
            {(meeting.actualStartAt || meeting.scheduledStartAt) && (
              <span className="text-sm text-muted-foreground">
                {format(new Date(meeting.actualStartAt || meeting.scheduledStartAt!), "MMMM d, yyyy 'at' h:mm a")}
              </span>
            )}
            {meeting.durationSeconds && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(meeting.durationSeconds)}
              </span>
            )}
            {meeting.participantCount && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                {meeting.participantCount} participants
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {meeting.status === "SCHEDULED" && (
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Process Recording
            </Button>
          )}
          {meeting.status === "COMPLETED" && meeting.summary && (
            <Button variant="outline" onClick={() => setIsResendOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Resend Summary
            </Button>
          )}
          {meeting.status === "PROCESSING" && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {meeting.status === "FAILED" && meeting.processingError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Processing Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{meeting.processingError}</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsUploadOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Processing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content Tabs */}
      {meeting.status === "COMPLETED" && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="summary">
              <FileText className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="action-items">
              <ListChecks className="h-4 w-4 mr-2" />
              Action Items ({meeting.actionItems.length})
            </TabsTrigger>
            <TabsTrigger value="transcript">
              <FileText className="h-4 w-4 mr-2" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="questions">
              <HelpCircle className="h-4 w-4 mr-2" />
              Questions ({meeting.questions.length})
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {meeting.summary && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line">{meeting.summary.executiveSummary}</p>
                  </CardContent>
                </Card>

                {meeting.summary.keyPoints.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Key Points</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {meeting.summary.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <div>
                              <span>{point.point}</span>
                              {point.speakerName && (
                                <span className="text-sm text-muted-foreground ml-2">
                                  — {point.speakerName}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {meeting.summary.decisions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Decisions Made</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {meeting.summary.decisions.map((decision, i) => (
                          <li key={i} className="border-l-2 border-primary pl-4">
                            <p className="font-medium">{decision.decision}</p>
                            {decision.context && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {decision.context}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {meeting.summary.topicsDiscussed.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Topics Discussed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {meeting.summary.topicsDiscussed.map((topic, i) => (
                          <Badge key={i} variant="secondary">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Action Items Tab */}
          <TabsContent value="action-items">
            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
                <CardDescription>
                  Tasks identified from the meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Status messages */}
                {actionItemError && (
                  <div className="flex items-center gap-2 text-destructive text-sm mb-4">
                    <AlertCircle className="h-4 w-4" />
                    {actionItemError}
                  </div>
                )}
                {actionItemSuccess && (
                  <div className="flex items-center gap-2 text-green-600 text-sm mb-4">
                    <CheckCircle className="h-4 w-4" />
                    {actionItemSuccess}
                  </div>
                )}
                {meeting.actionItems.length === 0 ? (
                  <p className="text-muted-foreground">No action items identified.</p>
                ) : (
                  <ul className="space-y-4">
                    {meeting.actionItems.map((item) => {
                      const isUpdating = updatingActionItemId === item.id;
                      const displayName = item.assigneeUser?.name || item.assigneeName;
                      const isAssigned = !!item.assigneeUserId || !!item.assigneeName;

                      return (
                        <li key={item.id} className="flex items-start gap-3 py-2">
                          {/* Checkbox */}
                          <Checkbox
                            checked={item.status === "COMPLETED"}
                            onCheckedChange={() => handleActionItemToggle(item.id, item.status)}
                            disabled={isUpdating}
                            className="mt-0.5"
                          />

                          {/* Avatar / User indicator */}
                          <div className="flex-shrink-0">
                            {item.assigneeUserId && item.assigneeUser ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    disabled={isUpdating}
                                  >
                                    <Avatar
                                      name={item.assigneeUser.name}
                                      id={item.assigneeUser.id}
                                      size="sm"
                                    />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Avatar
                                        name={item.assigneeUser.name}
                                        id={item.assigneeUser.id}
                                        size="md"
                                      />
                                      <div>
                                        <p className="font-medium text-sm">
                                          {item.assigneeUser.name || "Unnamed"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {item.assigneeUser.email}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="border-t pt-2">
                                      <UserPicker
                                        value={item.assigneeUserId}
                                        currentUserId={currentUser?.id}
                                        onSelect={(userId, user) => {
                                          handleActionItemAssign(item.id, userId, user?.name);
                                        }}
                                        placeholder="Reassign..."
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : item.assigneeName ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    disabled={isUpdating}
                                  >
                                    <Avatar name={item.assigneeName} size="sm" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Avatar name={item.assigneeName} size="md" />
                                      <div>
                                        <p className="font-medium text-sm">{item.assigneeName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Not linked to a user
                                        </p>
                                      </div>
                                    </div>
                                    <div className="border-t pt-2">
                                      <UserPicker
                                        value={null}
                                        currentUserId={currentUser?.id}
                                        onSelect={(userId, user) => {
                                          handleActionItemAssign(item.id, userId, user?.name);
                                        }}
                                        placeholder="Assign to user..."
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm",
                              item.status === "COMPLETED" && "line-through text-muted-foreground"
                            )}>
                              {item.description}
                            </p>

                            {/* Assignment and due date controls */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* Assignee display/control */}
                              {!item.assigneeUserId && !item.assigneeName && currentUser && (
                                <AssignToMeButton
                                  onClick={() => handleActionItemAssign(item.id, currentUser.id, currentUser.name)}
                                  disabled={isUpdating}
                                />
                              )}

                              {isAssigned && (
                                <span className="text-xs text-muted-foreground">
                                  {displayName}
                                </span>
                              )}

                              {/* Separator */}
                              {isAssigned && <span className="text-muted-foreground">|</span>}

                              {/* Due date control */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "text-xs h-7 px-2",
                                      !item.dueDate && "text-muted-foreground"
                                    )}
                                    disabled={isUpdating}
                                  >
                                    <Calendar className="mr-1 h-3 w-3" />
                                    {item.dueDate
                                      ? format(new Date(item.dueDate), "MMM d, yyyy")
                                      : "Set due date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-3" align="start">
                                  <div className="space-y-2">
                                    <Label htmlFor={`dueDate-${item.id}`} className="text-sm">
                                      Due Date
                                    </Label>
                                    <Input
                                      id={`dueDate-${item.id}`}
                                      type="date"
                                      value={item.dueDate ? item.dueDate.split("T")[0] : ""}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        handleActionItemDueDate(
                                          item.id,
                                          value ? new Date(value).toISOString() : null
                                        );
                                      }}
                                      className="w-40"
                                    />
                                    {item.dueDate && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => handleActionItemDueDate(item.id, null)}
                                      >
                                        Clear due date
                                      </Button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>

                              {/* Loading indicator */}
                              {isUpdating && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transcript Tab */}
          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Full Transcript</CardTitle>
                <CardDescription>
                  {meeting.transcript?.wordCount.toLocaleString()} words
                </CardDescription>
              </CardHeader>
              <CardContent>
                {meeting.transcript ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {meeting.transcript.segments.map((segment, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="text-sm text-muted-foreground w-16 flex-shrink-0">
                          {formatTimestamp(segment.startTime)}
                        </div>
                        <div>
                          <span className="font-medium text-primary">
                            {segment.speakerName}:
                          </span>{" "}
                          <span>{segment.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Transcript not available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Questions raised during the meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                {meeting.questions.length === 0 ? (
                  <p className="text-muted-foreground">No questions identified.</p>
                ) : (
                  <ul className="space-y-4">
                    {meeting.questions.map((q) => (
                      <li key={q.id} className="border-l-2 border-muted pl-4">
                        <div className="flex items-start gap-2">
                          {q.isAnswered ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                          ) : (
                            <HelpCircle className="h-4 w-4 text-yellow-600 mt-1" />
                          )}
                          <div>
                            <p className="font-medium">{q.question}</p>
                            {q.askedByName && (
                              <p className="text-sm text-muted-foreground">
                                Asked by {q.askedByName}
                              </p>
                            )}
                            {q.isAnswered && q.answer && (
                              <div className="mt-2 bg-muted p-3 rounded-md">
                                <p className="text-sm">{q.answer}</p>
                                {q.answeredByName && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    — {q.answeredByName}
                                  </p>
                                )}
                              </div>
                            )}
                            {!q.isAnswered && (
                              <Badge variant="outline" className="mt-2 text-yellow-700">
                                Follow-up needed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Upload/Process Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => {
        if (!open && uploadState !== "uploading" && uploadState !== "processing") {
          closeUploadDialog();
        } else if (open) {
          setIsUploadOpen(true);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Meeting Recording</DialogTitle>
            <DialogDescription>
              Upload an audio or video recording to transcribe and summarize.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {uploadState === "idle" && (
              <>
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-4">
                    {selectedFile ? (
                      <>
                        <File className="h-12 w-12 text-primary" />
                        <div>
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {isDragActive ? "Drop the file here" : "Drag & drop a recording here"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            or click to select a file
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Supported formats */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline">MP3</Badge>
                  <Badge variant="outline">MP4</Badge>
                  <Badge variant="outline">WAV</Badge>
                  <Badge variant="outline">WebM</Badge>
                  <Badge variant="outline">M4A</Badge>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Maximum file size: 500MB
                </p>

                {/* Error message */}
                {uploadError && (
                  <div className="flex items-center gap-2 text-destructive text-sm justify-center">
                    <AlertCircle className="h-4 w-4" />
                    {uploadError}
                  </div>
                )}

                {/* Selected file preview with remove option */}
                {selectedFile && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <File className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Uploading / Processing state */}
            {(uploadState === "uploading" || uploadState === "processing") && (
              <div className="space-y-4 text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <p className="font-medium">
                    {uploadState === "uploading" ? "Uploading recording..." : "Processing meeting..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {uploadState === "processing" && "Transcribing and generating summary"}
                  </p>
                </div>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  {uploadState === "processing" && "This may take a few minutes for longer recordings"}
                </p>
              </div>
            )}

            {/* Success state */}
            {uploadState === "success" && (
              <div className="space-y-4 text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <div>
                  <p className="font-medium">Recording processed successfully!</p>
                  <p className="text-sm text-muted-foreground">
                    The transcript and summary are now available.
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {uploadState === "error" && (
              <div className="space-y-4 text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <div>
                  <p className="font-medium">Upload failed</p>
                  <p className="text-sm text-muted-foreground">{uploadError}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {uploadState === "idle" && (
              <>
                <Button variant="outline" onClick={closeUploadDialog}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!selectedFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Process
                </Button>
              </>
            )}

            {uploadState === "success" && (
              <Button onClick={closeUploadDialog}>
                Done
              </Button>
            )}

            {uploadState === "error" && (
              <>
                <Button variant="outline" onClick={closeUploadDialog}>
                  Close
                </Button>
                <Button onClick={resetUploadDialog}>
                  Try Again
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Email Dialog */}
      <Dialog open={isResendOpen} onOpenChange={setIsResendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Summary Email</DialogTitle>
            <DialogDescription>
              Send the meeting summary to additional recipients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="emails">Email Addresses</Label>
              <Input
                id="emails"
                placeholder="email1@example.com, email2@example.com"
                value={resendEmails}
                onChange={(e) => setResendEmails(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Separate multiple email addresses with commas.
              </p>
            </div>
            {resendError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {resendError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResendEmail} disabled={isResending || !resendEmails.trim()}>
              {isResending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
