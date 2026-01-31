"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { format } from "date-fns";

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
  dueDate: string | null;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  contextSnippet: string | null;
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

  // Upload dialog
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingPath, setRecordingPath] = useState("");

  // Resend email dialog
  const [isResendOpen, setIsResendOpen] = useState(false);
  const [resendEmails, setResendEmails] = useState("");
  const [isResending, setIsResending] = useState(false);

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

  const handleStartProcessing = async () => {
    if (!recordingPath.trim()) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingPath }),
      });

      if (response.ok) {
        setIsUploadOpen(false);
        setRecordingPath("");
        fetchMeeting();
      }
    } catch (error) {
      console.error("Error starting processing:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendEmail = async () => {
    const emails = resendEmails.split(",").map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return;

    setIsResending(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/resend-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmails: emails }),
      });

      if (response.ok) {
        setIsResendOpen(false);
        setResendEmails("");
      }
    } catch (error) {
      console.error("Error resending email:", error);
    } finally {
      setIsResending(false);
    }
  };

  const handleActionItemToggle = async (actionItemId: string, currentStatus: string) => {
    const newStatus = currentStatus === "COMPLETED" ? "OPEN" : "COMPLETED";
    try {
      await fetch(`/api/meetings/${meetingId}/action-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, status: newStatus }),
      });
      fetchMeeting();
    } catch (error) {
      console.error("Error updating action item:", error);
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
                {meeting.actionItems.length === 0 ? (
                  <p className="text-muted-foreground">No action items identified.</p>
                ) : (
                  <ul className="space-y-4">
                    {meeting.actionItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-3">
                        <Checkbox
                          checked={item.status === "COMPLETED"}
                          onCheckedChange={() => handleActionItemToggle(item.id, item.status)}
                        />
                        <div className="flex-1">
                          <p className={item.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}>
                            {item.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {item.assigneeName && (
                              <span>Assigned to: {item.assigneeName}</span>
                            )}
                            {item.dueDate && (
                              <span>Due: {format(new Date(item.dueDate), "MMM d, yyyy")}</span>
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
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Recording</DialogTitle>
            <DialogDescription>
              Enter the path to the audio/video recording to process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recordingPath">Recording Path</Label>
              <Input
                id="recordingPath"
                placeholder="/path/to/recording.mp4 or s3://bucket/recording.mp4"
                value={recordingPath}
                onChange={(e) => setRecordingPath(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                The recording will be transcribed, summarized, and emailed to participants.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartProcessing} disabled={isProcessing || !recordingPath.trim()}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start Processing
            </Button>
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
