"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { MessageList } from "@/components/portal/message-list";
import { ReplyComposer } from "@/components/portal/reply-composer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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

export default function MessagesPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { session, isLoading, pinVerified, csrfToken } = usePortalSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if PIN verification is required
  useEffect(() => {
    if (!isLoading && session?.requiresPIN && !pinVerified) {
      router.replace(`/portal/${token}/pin`);
    }
  }, [isLoading, session, pinVerified, token, router]);

  // Fetch messages
  useEffect(() => {
    if (!isLoading && session && pinVerified) {
      fetchMessages();
    }
  }, [isLoading, session, pinVerified]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/portal/messages", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data.messages);

        // Mark unread messages as read
        for (const msg of data.data.messages) {
          if (msg.senderType === "CASE_MANAGER" && msg.status !== "READ") {
            fetch(`/api/portal/messages/${msg.id}`, {
              method: "POST",
              headers: {
                "X-CSRF-Token": csrfToken || "",
              },
              credentials: "include",
            }).catch(console.error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    try {
      const response = await fetch("/api/portal/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, data.data]);
        toast.success("Message sent");
      } else {
        const data = await response.json();
        toast.error(data.error?.message || "Failed to send message");
        throw new Error(data.error?.message);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  if (isLoading || isLoadingMessages) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Secure Messages</CardTitle>
              <p className="text-xs text-muted-foreground">
                {session.client.organization}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-h-[50vh] overflow-y-auto p-4">
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />
          </div>
          <ReplyComposer
            onSend={handleSendMessage}
            csrfToken={csrfToken}
          />
        </CardContent>
      </Card>

      {/* Security Notice */}
      <p className="text-xs text-center text-muted-foreground px-4">
        Your messages are encrypted and secure. Do not share your portal link.
      </p>
    </div>
  );
}
