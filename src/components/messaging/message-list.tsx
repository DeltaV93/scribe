"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageStatusBadge, SmsStatusIndicator } from "./message-status-badge";
import { MessageComposer } from "./message-composer";
import {
  MessageSquare,
  Plus,
  Loader2,
  User,
  UserCircle,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  content: string;
  status: "DRAFT" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  sentAt: string;
  readAt: string | null;
  sender?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  }[];
  smsNotification?: {
    deliveryStatus: string;
    sentAt: string | null;
    deliveredAt: string | null;
  } | null;
}

interface MessageListProps {
  clientId: string;
  clientName: string;
  smsEnabled: boolean;
}

export function MessageList({ clientId, clientName, smsEnabled }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const fetchMessages = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch(`/api/clients/${clientId}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      setMessages(data.data.messages);
      setError(null);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => fetchMessages()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchMessages(true)}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button size="sm" onClick={() => setComposerOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Message
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No messages yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start a conversation with {clientName}
              </p>
              <Button className="mt-4" onClick={() => setComposerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Send First Message
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={message.id}>
                    <div
                      className={`flex gap-3 ${
                        message.senderType === "CASE_MANAGER"
                          ? "flex-row"
                          : "flex-row-reverse"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {message.senderType === "CASE_MANAGER" ? (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-5 w-5 text-secondary-foreground" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`flex-1 ${
                          message.senderType === "CASE_MANAGER"
                            ? "pr-12"
                            : "pl-12"
                        }`}
                      >
                        <div
                          className={`rounded-lg p-3 ${
                            message.senderType === "CASE_MANAGER"
                              ? "bg-primary/10"
                              : "bg-secondary"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">
                              {message.senderType === "CASE_MANAGER"
                                ? message.sender?.name || message.sender?.email || "Case Manager"
                                : clientName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.sentAt)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center gap-2 text-xs text-muted-foreground"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span>{att.filename}</span>
                                  <span>({formatBytes(att.fileSize)})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <MessageStatusBadge
                            status={message.status}
                            smsStatus={
                              message.smsNotification?.deliveryStatus as
                                | "QUEUED"
                                | "SENT"
                                | "DELIVERED"
                                | "UNDELIVERED"
                                | "FAILED"
                                | undefined
                            }
                            showLabel={false}
                          />
                          {message.smsNotification && (
                            <SmsStatusIndicator
                              status={
                                message.smsNotification.deliveryStatus as
                                  | "QUEUED"
                                  | "SENT"
                                  | "DELIVERED"
                                  | "UNDELIVERED"
                                  | "FAILED"
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    {index < messages.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <MessageComposer
        clientId={clientId}
        clientName={clientName}
        smsEnabled={smsEnabled}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onMessageSent={() => fetchMessages()}
      />
    </>
  );
}
