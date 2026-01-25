"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, ShieldCheck, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PortalSession {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    organization: string;
  };
  messageId: string | null;
  expiresAt: string;
}

interface Message {
  id: string;
  content: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  status: string;
  sentAt: string;
  sender?: {
    name: string | null;
    email: string;
  } | null;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  }[];
}

export default function PortalEntryPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [session, setSession] = useState<PortalSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Validate token
      const validateRes = await fetch("/api/portal/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!validateRes.ok) {
        const data = await validateRes.json();
        setError(data.error?.message || "Invalid or expired link");
        setIsLoading(false);
        return;
      }

      const sessionData = await validateRes.json();
      setSession(sessionData.data);

      // Fetch messages
      const messagesRes = await fetch("/api/portal/messages", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData.data.messages);

        // Mark messages as read
        for (const msg of messagesData.data.messages) {
          if (msg.senderType === "CASE_MANAGER" && msg.status !== "READ") {
            fetch(`/api/portal/messages/${msg.id}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }).catch(console.error);
          }
        }
      }
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Something went wrong. Please try the link again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyContent.trim()) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/portal/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: replyContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([data.data, ...messages]);
        setReplyContent("");
      } else {
        const data = await response.json();
        alert(data.error?.message || "Failed to send reply");
      }
    } catch (err) {
      console.error("Error sending reply:", err);
      alert("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verifying your link...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Link Invalid</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            If you need to view your messages, please contact your case manager
            for a new link.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Secure Message Portal</CardTitle>
          <CardDescription>
            Welcome, {session.client.firstName}. This is your secure message portal from{" "}
            {session.client.organization}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Link expires {formatDistanceToNow(new Date(session.expiresAt), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Your Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No messages yet.
            </p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.senderType === "CASE_MANAGER"
                      ? "bg-primary/10"
                      : "bg-secondary ml-8"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {message.senderType === "CASE_MANAGER"
                        ? message.sender?.name || "Your Case Manager"
                        : "You"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <span>Attachment: {att.filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reply</CardTitle>
          <CardDescription>
            Send a secure message back to your case manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Type your message here..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={isSending}
          />
          <Button
            onClick={handleSendReply}
            disabled={isSending || !replyContent.trim()}
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reply"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <p className="text-xs text-center text-muted-foreground">
        This is a secure portal. Your messages are encrypted and protected.
        Do not share this link with anyone.
      </p>
    </div>
  );
}
