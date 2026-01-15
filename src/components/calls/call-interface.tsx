"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CallControls } from "./call-controls";
import { CallTimer } from "./call-timer";
import { CallStatusBadge } from "./call-status-badge";
import { CallNotesPanel } from "./call-notes-panel";
import { ConversationGuide } from "./conversation-guide";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, User } from "lucide-react";
import { CallStatus } from "@prisma/client";
import { toast } from "sonner";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface FormField {
  id: string;
  slug: string;
  label: string;
  type: string;
  required: boolean;
}

interface FormSection {
  formId: string;
  formName: string;
  fields: FormField[];
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author?: {
    name: string | null;
    email: string;
  };
}

interface CallInterfaceProps {
  callId: string;
  client: Client;
  formSections: FormSection[];
  previousNotes: Note[];
  initialStatus?: CallStatus;
}

export function CallInterface({
  callId,
  client,
  formSections,
  previousNotes,
  initialStatus = CallStatus.INITIATING,
}: CallInterfaceProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "m":
          handleMuteToggle();
          break;
        case "e":
          handleEndCall();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Set start time when call becomes in progress
  useEffect(() => {
    if (status === CallStatus.IN_PROGRESS && !startTime) {
      setStartTime(new Date());
    }
  }, [status, startTime]);

  // Poll for status updates
  useEffect(() => {
    if (
      status === CallStatus.COMPLETED ||
      status === CallStatus.FAILED ||
      status === CallStatus.ABANDONED
    ) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/calls/${callId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data.status !== status) {
            setStatus(data.data.status);
          }
        }
      } catch (error) {
        console.error("Error polling call status:", error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [callId, status]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => !prev);
    // TODO: Integrate with Twilio SDK to actually mute
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  }, [isMuted]);

  const handleHoldToggle = useCallback(() => {
    setIsOnHold((prev) => !prev);
    // TODO: Integrate with Twilio SDK to actually hold
    toast.info(isOnHold ? "Call resumed" : "Call on hold");
  }, [isOnHold]);

  const handleEndCall = async () => {
    if (isEndingCall) return;

    setIsEndingCall(true);
    try {
      // Save any unsaved notes first
      if (currentNote.trim()) {
        await saveNote();
      }

      // End the call
      const response = await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to end call");
      }

      setStatus(CallStatus.COMPLETED);
      toast.success("Call ended");

      // Redirect to review screen
      router.push(`/calls/${callId}/review`);
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Failed to end call");
    } finally {
      setIsEndingCall(false);
    }
  };

  const saveNote = async () => {
    if (!currentNote.trim()) return;

    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/clients/${client.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: currentNote,
          callId,
          type: "INTERNAL",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save note");
      }

      toast.success("Note saved");
      setCurrentNote("");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleFieldToggle = (fieldId: string) => {
    const newCompleted = new Set(completedFields);
    if (newCompleted.has(fieldId)) {
      newCompleted.delete(fieldId);
    } else {
      newCompleted.add(fieldId);
    }
    setCompletedFields(newCompleted);
  };

  const isConnected = status === CallStatus.IN_PROGRESS;
  const activeStatuses: CallStatus[] = [
    CallStatus.INITIATING,
    CallStatus.RINGING,
    CallStatus.IN_PROGRESS,
  ];
  const isActive = activeStatuses.includes(status);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold">
                {client.firstName} {client.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{client.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CallStatusBadge status={status} />
            <CallTimer startTime={startTime} isActive={isActive} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Notes Panel (Left/Main) */}
        <div className="lg:col-span-2 overflow-auto">
          <CallNotesPanel
            currentNote={currentNote}
            onNoteChange={setCurrentNote}
            previousNotes={previousNotes}
            onSaveNote={saveNote}
            isSaving={isSavingNote}
          />
        </div>

        {/* Conversation Guide (Right) */}
        <div className="overflow-auto">
          <ConversationGuide
            sections={formSections}
            completedFields={completedFields}
            onFieldToggle={handleFieldToggle}
          />
        </div>
      </div>

      {/* Call Controls */}
      <CallControls
        isMuted={isMuted}
        isOnHold={isOnHold}
        isConnected={isConnected}
        onMuteToggle={handleMuteToggle}
        onHoldToggle={handleHoldToggle}
        onEndCall={handleEndCall}
        disabled={isEndingCall || !isActive}
      />
    </div>
  );
}
