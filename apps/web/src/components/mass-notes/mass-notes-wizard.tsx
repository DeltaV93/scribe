"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  FileText,
  Eye,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface Program {
  id: string;
  name: string;
}

interface Session {
  id: string;
  title: string;
  sessionNumber: number;
  date: string | null;
}

interface Attendee {
  clientId: string;
  clientName: string;
  status: string;
  attendanceType: string | null;
  hoursAttended: number | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  scope: string;
  isDefault: boolean;
}

interface Preview {
  clientId: string;
  clientName: string;
  resolvedContent: string;
}

interface BatchStatus {
  id: string;
  status: string;
  progress: number;
  total: number;
  completed: number;
  failed: number;
}

type WizardStep = "session" | "clients" | "template" | "preview" | "submit";

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: "session", label: "Select Session", icon: <FileText className="h-4 w-4" /> },
  { key: "clients", label: "Select Clients", icon: <Users className="h-4 w-4" /> },
  { key: "template", label: "Note Template", icon: <FileText className="h-4 w-4" /> },
  { key: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
  { key: "submit", label: "Create Notes", icon: <Send className="h-4 w-4" /> },
];

const AVAILABLE_VARIABLES = [
  { key: "client.firstName", description: "Client's first name" },
  { key: "client.lastName", description: "Client's last name" },
  { key: "client.fullName", description: "Client's full name" },
  { key: "session.title", description: "Session title" },
  { key: "session.date", description: "Session date" },
  { key: "session.topic", description: "Session topic" },
  { key: "session.duration", description: "Session duration" },
  { key: "program.name", description: "Program name" },
  { key: "program.facilitator", description: "Facilitator name" },
  { key: "attendance.type", description: "Attendance type (Present/Excused/Absent)" },
  { key: "attendance.timeIn", description: "Check-in time" },
  { key: "attendance.timeOut", description: "Check-out time" },
  { key: "attendance.hoursAttended", description: "Hours attended" },
];

export function MassNotesWizard() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<WizardStep>("session");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);

  // Form state
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templateContent, setTemplateContent] = useState<string>("");
  const [noteType, setNoteType] = useState<"INTERNAL" | "SHAREABLE">("INTERNAL");
  const [tags, setTags] = useState<string[]>([]);

  // Batch tracking
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);

  // Load programs on mount
  useEffect(() => {
    loadPrograms();
    loadTemplates();
  }, []);

  // Load sessions when program changes
  useEffect(() => {
    if (selectedProgram) {
      loadSessions(selectedProgram);
    } else {
      setSessions([]);
    }
  }, [selectedProgram]);

  // Load attendees when session changes
  useEffect(() => {
    if (selectedSession) {
      loadAttendees(selectedSession);
    } else {
      setAttendees([]);
      setSelectedClients([]);
    }
  }, [selectedSession]);

  // Update template content when template selection changes
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setTemplateContent(template.content);
      }
    }
  }, [selectedTemplate, templates]);

  // Poll batch status
  useEffect(() => {
    if (!batchId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mass-notes/${batchId}`);
        if (res.ok) {
          const data = await res.json();
          setBatchStatus(data.data);

          if (data.data.status === "COMPLETED" || data.data.status === "FAILED") {
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error("Error polling batch status:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batchId]);

  // API calls
  async function loadPrograms() {
    try {
      const res = await fetch("/api/programs?status=ACTIVE");
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.data || []);
      }
    } catch (error) {
      console.error("Error loading programs:", error);
    }
  }

  async function loadSessions(programId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/programs/${programId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendees(sessionId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/mass-notes?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setAttendees(data.data?.attendees || []);
      }
    } catch (error) {
      console.error("Error loading attendees:", error);
      toast.error("Failed to load session attendees");
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/mass-notes/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);

        // Set default template if exists
        const defaultTemplate = data.data?.find((t: Template) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
          setTemplateContent(defaultTemplate.content);
        }
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  }

  async function loadPreviews() {
    if (selectedClients.length === 0 || !templateContent) return;

    setLoading(true);
    try {
      const res = await fetch("/api/mass-notes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession,
          templateContent,
          clientIds: selectedClients.slice(0, 10),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviews(data.data || []);
      } else {
        const error = await res.json();
        toast.error(error.error?.message || "Failed to generate previews");
      }
    } catch (error) {
      console.error("Error loading previews:", error);
      toast.error("Failed to generate previews");
    } finally {
      setLoading(false);
    }
  }

  async function submitMassNotes() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/mass-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession,
          templateId: selectedTemplate || undefined,
          templateContent,
          noteType,
          tags,
          clientIds: selectedClients,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatchId(data.data.jobId);
        toast.success(`Creating notes for ${selectedClients.length} clients...`);
      } else {
        const error = await res.json();
        toast.error(error.error?.message || "Failed to create mass notes");
      }
    } catch (error) {
      console.error("Error creating mass notes:", error);
      toast.error("Failed to create mass notes");
    } finally {
      setSubmitting(false);
    }
  }

  // Navigation
  function nextStep() {
    const currentIndex = STEPS.findIndex((s) => s.key === step);
    if (currentIndex < STEPS.length - 1) {
      const next = STEPS[currentIndex + 1].key;
      if (next === "preview") {
        loadPreviews();
      }
      setStep(next);
    }
  }

  function prevStep() {
    const currentIndex = STEPS.findIndex((s) => s.key === step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].key);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case "session":
        return !!selectedSession;
      case "clients":
        return selectedClients.length > 0;
      case "template":
        return !!templateContent.trim();
      case "preview":
        return true;
      case "submit":
        return batchStatus?.status === "COMPLETED";
      default:
        return false;
    }
  }

  // Toggle client selection
  function toggleClient(clientId: string) {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  }

  function selectAllClients() {
    setSelectedClients(attendees.map((a) => a.clientId));
  }

  function deselectAllClients() {
    setSelectedClients([]);
  }

  // Insert variable into template
  function insertVariable(variable: string) {
    setTemplateContent((prev) => prev + `{{${variable}}}`);
  }

  // Render step content
  function renderStepContent() {
    switch (step) {
      case "session":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="program">Program</Label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProgram && (
              <div className="space-y-2">
                <Label htmlFor="session">Session</Label>
                {loading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading sessions...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No sessions found for this program. Create sessions first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.title}
                          {session.date && (
                            <span className="ml-2 text-muted-foreground">
                              ({new Date(session.date).toLocaleDateString()})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        );

      case "clients":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Session Attendees</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedClients.length} of {attendees.length} selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllClients}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllClients}>
                  Deselect All
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : attendees.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No attendees found for this session. Make sure attendance has been recorded.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                {attendees.map((attendee) => (
                  <div
                    key={attendee.clientId}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleClient(attendee.clientId)}
                  >
                    <Checkbox
                      checked={selectedClients.includes(attendee.clientId)}
                      onCheckedChange={() => toggleClient(attendee.clientId)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{attendee.clientName}</div>
                      <div className="text-sm text-muted-foreground">
                        {attendee.attendanceType || "Present"}
                        {attendee.hoursAttended && ` - ${attendee.hoursAttended} hours`}
                      </div>
                    </div>
                    <Badge variant="outline">{attendee.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "template":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="templateSelect">Use Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or create custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Custom Note</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Note Content</Label>
              <Textarea
                id="content"
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                placeholder="Enter note content with variables like {{client.firstName}}..."
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use variables to personalize notes for each client.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                    title={v.description}
                  >
                    {`{{${v.key}}}`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="noteType">Note Type</Label>
                <Select
                  value={noteType}
                  onValueChange={(v) => setNoteType(v as "INTERNAL" | "SHAREABLE")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">Internal</SelectItem>
                    <SelectItem value="SHAREABLE">Shareable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Showing preview for up to 10 clients. Variables will be replaced with actual values.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadPreviews} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : previews.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No previews available. Make sure you have selected clients and entered template content.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {previews.map((preview) => (
                  <Card key={preview.clientId}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{preview.clientName}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                      <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded">
                        {preview.resolvedContent}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case "submit":
        return (
          <div className="space-y-6">
            {!batchId ? (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    You are about to create notes for {selectedClients.length} clients.
                    This action cannot be undone.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Session</span>
                    <span>{sessions.find((s) => s.id === selectedSession)?.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Clients</span>
                    <span>{selectedClients.length} selected</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Note Type</span>
                    <span>{noteType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Template</span>
                    <span>
                      {selectedTemplate
                        ? templates.find((t) => t.id === selectedTemplate)?.name
                        : "Custom"}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={submitMassNotes}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating Notes...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create {selectedClients.length} Notes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-6">
                {batchStatus?.status === "COMPLETED" ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Successfully created {batchStatus.completed} notes!
                      {batchStatus.failed > 0 && ` (${batchStatus.failed} failed)`}
                    </AlertDescription>
                  </Alert>
                ) : batchStatus?.status === "FAILED" ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Failed to create notes. Please try again.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating notes...</span>
                    </div>
                    <Progress value={batchStatus?.progress ?? 0} />
                    <div className="text-sm text-muted-foreground text-center">
                      {batchStatus?.completed ?? 0} of {batchStatus?.total ?? selectedClients.length} completed
                    </div>
                  </div>
                )}

                {batchStatus?.status === "COMPLETED" && (
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setBatchId(null);
                        setBatchStatus(null);
                        setStep("session");
                        setSelectedProgram("");
                        setSelectedSession("");
                        setSelectedClients([]);
                      }}
                    >
                      Create More Notes
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => router.push("/clients")}
                    >
                      View Clients
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4 mb-4">
          {STEPS.map((s, index) => (
            <div
              key={s.key}
              className={`flex items-center gap-2 ${
                index === currentStepIndex
                  ? "text-primary"
                  : index < currentStepIndex
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index === currentStepIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : index < currentStepIndex
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-muted-foreground"
                }`}
              >
                {index < currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="text-sm">{index + 1}</span>
                )}
              </div>
              <span className="text-sm font-medium hidden md:inline">{s.label}</span>
              {index < STEPS.length - 1 && (
                <div className="w-8 h-px bg-border hidden md:block" />
              )}
            </div>
          ))}
        </div>
        <CardTitle>{STEPS[currentStepIndex].label}</CardTitle>
        <CardDescription>
          {step === "session" && "Choose the program and session for mass note creation."}
          {step === "clients" && "Select the clients who will receive notes."}
          {step === "template" && "Create or select a note template with variables."}
          {step === "preview" && "Review how notes will appear for each client."}
          {step === "submit" && "Confirm and create notes for all selected clients."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {renderStepContent()}

        {/* Navigation */}
        {step !== "submit" && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === "session"}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={nextStep} disabled={!canProceed()}>
              {step === "preview" ? "Continue to Submit" : "Next"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
