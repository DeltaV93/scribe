"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptSegment {
  speaker: "CASE_MANAGER" | "CLIENT" | "UNCERTAIN";
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isFinal: boolean;
}

interface LiveTranscriptProps {
  callId: string;
  isActive: boolean;
  onTranscriptUpdate?: (segments: TranscriptSegment[]) => void;
}

const speakerLabels = {
  CASE_MANAGER: { label: "You", color: "bg-primary text-primary-foreground" },
  CLIENT: { label: "Client", color: "bg-secondary text-secondary-foreground" },
  UNCERTAIN: { label: "Speaker", color: "bg-muted text-muted-foreground" },
};

export function LiveTranscript({
  callId,
  isActive,
  onTranscriptUpdate,
}: LiveTranscriptProps) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const [interimSpeaker, setInterimSpeaker] = useState<TranscriptSegment["speaker"] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText]);

  // Notify parent of transcript updates
  useEffect(() => {
    onTranscriptUpdate?.(segments);
  }, [segments, onTranscriptUpdate]);

  // Connect to Server-Sent Events for live transcript
  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/calls/${callId}/transcript/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "transcript") {
          const segment = data.segment as TranscriptSegment;

          if (segment.isFinal) {
            setSegments((prev) => [...prev, segment]);
            setInterimText("");
            setInterimSpeaker(null);
          } else {
            setInterimText(segment.text);
            setInterimSpeaker(segment.speaker);
          }
        } else if (data.type === "utterance_end") {
          // Clear interim when utterance ends
          setInterimText("");
          setInterimSpeaker(null);
        } else if (data.type === "error") {
          setError(data.error);
        }
      } catch (e) {
        console.error("Error parsing transcript event:", e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError("Connection lost. Reconnecting...");
      eventSource.close();

      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (isActive) {
          connectToStream();
        }
      }, 3000);
    };
  }, [callId, isActive]);

  // Manage connection based on call state
  useEffect(() => {
    if (isActive) {
      connectToStream();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isActive, connectToStream]);

  // Fetch existing transcript on mount
  useEffect(() => {
    const fetchExistingTranscript = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/transcript`);
        if (response.ok) {
          const data = await response.json();
          if (data.data?.segments) {
            setSegments(data.data.segments);
          }
        }
      } catch (e) {
        console.error("Error fetching existing transcript:", e);
      }
    };

    fetchExistingTranscript();
  }, [callId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Live Transcript
          </CardTitle>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className="text-xs"
              >
                {isConnected ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1" />
                    Live
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Connecting
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-3">
            {segments.length === 0 && !interimText && (
              <div className="text-center text-muted-foreground py-8">
                {isActive ? (
                  <div className="space-y-2">
                    <Mic className="h-8 w-8 mx-auto opacity-50" />
                    <p>Listening for speech...</p>
                    <p className="text-xs">
                      Transcript will appear here as the conversation progresses
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <MicOff className="h-8 w-8 mx-auto opacity-50" />
                    <p>Transcription will begin when the call starts</p>
                  </div>
                )}
              </div>
            )}

            {segments.map((segment, index) => {
              const config = speakerLabels[segment.speaker];
              return (
                <div key={index} className="flex gap-2">
                  <div className="flex-shrink-0 pt-0.5">
                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(segment.startTime)}
                      </span>
                      {segment.confidence < 0.8 && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          Low confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Interim text (not yet finalized) */}
            {interimText && interimSpeaker && (
              <div className="flex gap-2 opacity-60">
                <div className="flex-shrink-0 pt-0.5">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", speakerLabels[interimSpeaker].color)}
                  >
                    {speakerLabels[interimSpeaker].label}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed italic">{interimText}</p>
                  <span className="text-xs text-muted-foreground">typing...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
