"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CallControls } from "./call-controls";
import { CallTimer } from "./call-timer";
import { CallStatusBadge } from "./call-status-badge";
import { CallNotesPanel } from "./call-notes-panel";
import { ConversationGuide } from "./conversation-guide";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Phone, User, Lock, AlertTriangle, Mic } from "lucide-react";
import { CallStatus } from "@prisma/client";
import { toast } from "sonner";
import { useTwilioDevice } from "@/hooks/use-twilio-device";

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
  const [currentNote, setCurrentNote] = useState("");
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [hasClientLock, setHasClientLock] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [browserCallConnected, setBrowserCallConnected] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const hasLockRef = useRef(false);
  const browserCallInitiated = useRef(false);

  // Twilio Device for browser audio
  const {
    deviceStatus,
    callState,
    error: twilioError,
    isReady: twilioReady,
    makeCall,
    hangup: twilioHangup,
    mute,
  } = useTwilioDevice({
    onCallDisconnected: () => {
      setBrowserCallConnected(false);
    },
    onError: (error) => {
      console.error("Twilio error:", error);
      if (error.message?.includes("Permission") || error.message?.includes("microphone")) {
        setMicPermissionDenied(true);
      }
    },
  });

  // Derive mute/hold state from Twilio
  const isMuted = callState.isMuted;
  const isOnHold = callState.isOnHold;

  // Keep ref in sync with state
  useEffect(() => {
    hasLockRef.current = hasClientLock;
  }, [hasClientLock]);

  // Acquire client lock when call starts
  const acquireClientLock = useCallback(async () => {
    try {
      const response = await fetch("/api/locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: "client",
          resourceId: client.id,
          expirationMs: 600000, // 10 minutes for calls
        }),
      });

      const data = await response.json();
      if (data.success) {
        setHasClientLock(true);
        setLockError(null);
        return true;
      } else {
        setLockError(data.error?.message || "Failed to acquire lock");
        return false;
      }
    } catch (error) {
      setLockError("Failed to acquire client lock");
      return false;
    }
  }, [client.id]);

  // Release client lock
  const releaseClientLock = useCallback(async () => {
    if (!hasLockRef.current) return;

    try {
      await fetch("/api/locks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: "client",
          resourceId: client.id,
        }),
      });
      setHasClientLock(false);
    } catch (error) {
      console.error("Error releasing client lock:", error);
    }
  }, [client.id]);

  // Start heartbeat to extend lock
  const startLockHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      if (!hasLockRef.current) return;

      try {
        await fetch("/api/locks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceType: "client",
            resourceId: client.id,
            expirationMs: 600000,
          }),
        });
      } catch (error) {
        console.error("Error extending lock:", error);
      }
    }, 120000); // Extend every 2 minutes
  }, [client.id]);

  const stopLockHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Acquire lock when call becomes active
  useEffect(() => {
    const activeStatuses: CallStatus[] = [
      CallStatus.INITIATING,
      CallStatus.RINGING,
      CallStatus.IN_PROGRESS,
    ];

    if (activeStatuses.includes(status) && !hasClientLock) {
      acquireClientLock().then((success) => {
        if (success) {
          startLockHeartbeat();
        }
      });
    }

    // Release lock when call ends
    const endedStatuses: CallStatus[] = [
      CallStatus.COMPLETED,
      CallStatus.FAILED,
      CallStatus.ABANDONED,
    ];

    if (endedStatuses.includes(status)) {
      stopLockHeartbeat();
      releaseClientLock();
    }
  }, [status, hasClientLock, acquireClientLock, startLockHeartbeat, stopLockHeartbeat, releaseClientLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLockHeartbeat();
      if (hasLockRef.current) {
        // Fire and forget release on unmount
        fetch("/api/locks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceType: "client",
            resourceId: client.id,
          }),
        }).catch(() => {});
      }
    };
  }, [client.id, stopLockHeartbeat]);

  // Handle page unload - release lock via beacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasLockRef.current) {
        const data = JSON.stringify({
          resourceType: "client",
          resourceId: client.id,
        });
        navigator.sendBeacon?.(
          "/api/locks/release-beacon",
          new Blob([data], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [client.id]);

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

  // Connect browser audio when Twilio device is ready and call is active
  useEffect(() => {
    // Log device status for debugging
    console.log("[CallInterface] Device status check:", {
      deviceStatus,
      twilioReady,
      browserCallConnected,
      browserCallInitiated: browserCallInitiated.current,
      callStatus: status,
    });

    const connectBrowserCall = async () => {
      // Only proceed if device is actually ready
      if (!twilioReady) {
        console.log("[CallInterface] Waiting for Twilio device to be ready...");
        return;
      }

      if (browserCallConnected || browserCallInitiated.current) {
        return;
      }

      const activeStatuses: CallStatus[] = [CallStatus.INITIATING, CallStatus.RINGING, CallStatus.IN_PROGRESS];
      if (!activeStatuses.includes(status)) {
        return;
      }

      browserCallInitiated.current = true;
      try {
        console.log("[CallInterface] Connecting browser audio to call...");
        await makeCall(client.phone, { callId });
        setBrowserCallConnected(true);
        toast.success("Connected to call");
      } catch (error) {
        console.error("[CallInterface] Failed to connect browser audio:", error);
        browserCallInitiated.current = false;
        if (error instanceof Error && error.message.includes("Permission")) {
          setMicPermissionDenied(true);
          toast.error("Microphone permission denied. Please allow microphone access.");
        } else {
          toast.error("Failed to connect to call");
        }
      }
    };

    connectBrowserCall();
  }, [deviceStatus, twilioReady, browserCallConnected, status, client.phone, callId, makeCall]);

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
    mute(!isMuted);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  }, [isMuted, mute]);

  const handleHoldToggle = useCallback(() => {
    // Hold is implemented as mute in the current Twilio setup
    mute(!isOnHold);
    toast.info(isOnHold ? "Call resumed" : "Call on hold");
  }, [isOnHold, mute]);

  const handleEndCall = async () => {
    if (isEndingCall) return;

    setIsEndingCall(true);
    try {
      // Save any unsaved notes first
      if (currentNote.trim()) {
        await saveNote();
      }

      // Disconnect browser audio first
      if (browserCallConnected) {
        twilioHangup();
        setBrowserCallConnected(false);
      }

      // End the call on server
      const response = await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to end call");
      }

      // Release the client lock
      stopLockHeartbeat();
      await releaseClientLock();

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
      {/* Microphone Permission Banner */}
      {micPermissionDenied && (
        <Alert variant="destructive" className="m-4 mb-0">
          <Mic className="h-4 w-4" />
          <AlertTitle>Microphone Access Required</AlertTitle>
          <AlertDescription>
            Please allow microphone access in your browser to participate in the call.
            Click the microphone icon in your browser&apos;s address bar and refresh the page.
          </AlertDescription>
        </Alert>
      )}

      {/* Twilio Connection Status */}
      {twilioError && !micPermissionDenied && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{twilioError}</AlertDescription>
        </Alert>
      )}

      {/* Lock Error Banner */}
      {lockError && (
        <Alert variant="destructive" className="m-4 mb-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Lock Warning</AlertTitle>
          <AlertDescription>
            {lockError}. Another case manager may be working with this client.
          </AlertDescription>
        </Alert>
      )}

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
            {hasClientLock && (
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                <Lock className="h-3 w-3" />
                <span>Exclusive access</span>
              </div>
            )}
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
