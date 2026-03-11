"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Video,
  Phone,
  Search,
  Filter,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConversationType, ConversationStatus, SensitivityTier } from "@prisma/client";

interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  status: ConversationStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  sensitivityTier: SensitivityTier;
  createdBy: {
    id: string;
    name: string | null;
  };
  _count: {
    flaggedSegments: number;
    draftedOutputs: number;
  };
}

const TYPE_ICONS: Record<ConversationType, React.ReactNode> = {
  PHONE_CALL: <Phone className="h-4 w-4" />,
  IN_PERSON: <Mic className="h-4 w-4" />,
  VIDEO_MEETING: <Video className="h-4 w-4" />,
};

const STATUS_BADGES: Record<ConversationStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  SCHEDULED: { label: "Scheduled", variant: "outline" },
  RECORDING: { label: "Recording", variant: "default" },
  PROCESSING: { label: "Processing", variant: "secondary" },
  REVIEW: { label: "Review", variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  FAILED: { label: "Failed", variant: "destructive" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long", hour: "numeric", minute: "2-digit" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }
}

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchConversations();
  }, [statusFilter, typeFilter]);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const response = await fetch(`/api/conversations?${params}`);
      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.createdBy.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-muted-foreground">
            Recorded conversations and their extracted outputs
          </p>
        </div>
        <Button onClick={() => router.push("/conversations/new")}>
          <Mic className="mr-2 h-4 w-4" />
          New Recording
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="RECORDING">Recording</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="REVIEW">Needs Review</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="IN_PERSON">In-Person</SelectItem>
            <SelectItem value="PHONE_CALL">Phone Call</SelectItem>
            <SelectItem value="VIDEO_MEETING">Video Meeting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mic className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No conversations yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a new recording to capture your first conversation.
            </p>
            <Button className="mt-4" onClick={() => router.push("/conversations/new")}>
              <Mic className="mr-2 h-4 w-4" />
              New Recording
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conversation) => {
            const statusInfo = STATUS_BADGES[conversation.status];
            const hasFlags = conversation._count.flaggedSegments > 0;
            const hasOutputs = conversation._count.draftedOutputs > 0;

            return (
              <Card
                key={conversation.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/conversations/${conversation.id}`)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Type icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {TYPE_ICONS[conversation.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">
                        {conversation.title || "Untitled Conversation"}
                      </h3>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
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
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{formatDate(conversation.startedAt)}</span>
                      <span>•</span>
                      <span>{formatDuration(conversation.durationSeconds)}</span>
                      <span>•</span>
                      <span>{conversation.createdBy.name || "Unknown"}</span>
                    </div>
                  </div>

                  {/* Indicators */}
                  <div className="flex items-center gap-2">
                    {conversation.status === "REVIEW" && (
                      <>
                        {hasFlags && (
                          <Badge variant="outline" className="gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {conversation._count.flaggedSegments}
                          </Badge>
                        )}
                        {hasOutputs && (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {conversation._count.draftedOutputs}
                          </Badge>
                        )}
                      </>
                    )}
                    {conversation.status === "PROCESSING" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
