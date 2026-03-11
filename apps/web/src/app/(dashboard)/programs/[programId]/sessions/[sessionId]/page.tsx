"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionAttendanceTab } from "@/components/attendance/session-attendance-tab";
import { ArrowLeft, Calendar, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface SessionDetail {
  id: string;
  sessionNumber: number;
  title: string;
  topic: string | null;
  date: string | null;
  durationMinutes: number | null;
  notes: string | null;
  program: {
    id: string;
    name: string;
  };
  _count?: {
    attendance: number;
    materials: number;
  };
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(
          `/api/programs/${programId}/sessions/${sessionId}`
        );
        if (response.ok) {
          const data = await response.json();
          setSession(data.data);
        } else if (response.status === 404) {
          router.push(`/programs/${programId}`);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [programId, sessionId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/programs/${programId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">
            {session.program?.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Session {session.sessionNumber}: {session.title}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {session.date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.date), "MMM d, yyyy")}
              </span>
            )}
            {session.durationMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.durationMinutes} min
              </span>
            )}
          </div>
          {session.topic && (
            <p className="mt-2 text-muted-foreground">{session.topic}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="rounded-lg border p-6 space-y-4">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground">
                Title
              </h3>
              <p>{session.title}</p>
            </div>
            {session.topic && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">
                  Topic
                </h3>
                <p>{session.topic}</p>
              </div>
            )}
            {session.notes && (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground">
                  Notes
                </h3>
                <p className="whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <SessionAttendanceTab
            programId={programId}
            sessionId={sessionId}
            programName={session.program?.name || ""}
            sessionTitle={session.title}
            sessionNumber={session.sessionNumber}
            sessionDate={session.date}
            durationMinutes={session.durationMinutes}
          />
        </TabsContent>

        <TabsContent value="materials">
          <div className="text-center py-8 text-muted-foreground">
            <p>Session materials</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
