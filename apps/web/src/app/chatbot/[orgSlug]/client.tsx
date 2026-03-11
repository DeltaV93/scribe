"use client";

/**
 * Chatbot Client Component
 *
 * Interactive chat interface for the chatbot intake.
 * Handles message sending, session management, and crisis resources display.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  User,
  Bot,
  Phone,
  AlertTriangle,
  Loader2,
  CheckCircle,
  MinusCircle,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface CrisisResource {
  name: string;
  phone?: string;
  url?: string;
  description: string;
}

interface ChatSession {
  id: string;
  status: string;
  crisisDetected: boolean;
  handoffRequested: boolean;
}

interface ChatbotClientProps {
  orgSlug: string;
  orgName: string;
  formId?: string;
  primaryColor: string;
  logoUrl?: string;
}

export default function ChatbotClient({
  orgSlug,
  orgName,
  formId,
  primaryColor,
  logoUrl,
}: ChatbotClientProps) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResource[] | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Initialize session
  useEffect(() => {
    async function initSession() {
      try {
        const response = await fetch("/api/chatbot/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgSlug, formId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "Failed to start chat");
        }

        const data = await response.json();
        setSession(data.data.session);

        // Add welcome and first question as messages
        const welcomeMessage: ChatMessage = {
          id: "welcome",
          role: "assistant",
          content: data.data.welcomeMessage,
          createdAt: new Date().toISOString(),
        };

        const firstQuestion: ChatMessage = {
          id: "first-question",
          role: "assistant",
          content: data.data.firstQuestion,
          createdAt: new Date().toISOString(),
        };

        setMessages([welcomeMessage, firstQuestion]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start chat");
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, [orgSlug, formId]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input after loading
  useEffect(() => {
    if (!isInitializing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isInitializing]);

  // Send message to parent window (for widget)
  const notifyParent = useCallback((type: string, data?: Record<string, unknown>) => {
    if (window.parent !== window) {
      window.parent.postMessage({ source: "scrybe-chatbot", type, ...data }, "*");
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !session || isLoading || isComplete) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch(`/api/chatbot/sessions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to send message");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: data.data.message.id,
        role: "assistant",
        content: data.data.message.content,
        createdAt: data.data.message.createdAt,
        metadata: data.data.message.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle crisis detection
      if (data.data.crisisDetected && data.data.crisisResources) {
        setCrisisResources(data.data.crisisResources.resources);
        setSession((prev) => prev ? { ...prev, crisisDetected: true } : null);
      }

      // Handle completion
      if (data.data.isComplete) {
        setIsComplete(true);
      }

      // Notify parent of new message
      notifyParent("newMessage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Request handoff
  const requestHandoff = async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/chatbot/sessions/${session.id}/handoff`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to request handoff");
      }

      const data = await response.json();

      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: data.data.message,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, systemMessage]);
      setSession((prev) => prev ? { ...prev, handoffRequested: true } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request handoff");
    } finally {
      setIsLoading(false);
    }
  };

  // Complete session
  const completeIntake = async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/chatbot/sessions/${session.id}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to complete intake");
      }

      const data = await response.json();
      setCompletionMessage(data.data.message);
      setSession((prev) => prev ? { ...prev, status: "COMPLETED" } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete intake");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Minimize/close handler
  const handleMinimize = () => {
    notifyParent("minimize");
  };

  // Loading state
  if (isInitializing) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <Header
          orgName={orgName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          onMinimize={handleMinimize}
        />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <Header
          orgName={orgName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          onMinimize={handleMinimize}
        />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Unable to start chat
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Completion state
  if (completionMessage) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <Header
          orgName={orgName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          onMinimize={handleMinimize}
        />
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Intake Complete!
            </h2>
            <p className="mt-2 text-sm text-gray-600">{completionMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <Header
        orgName={orgName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        onMinimize={handleMinimize}
      />

      {/* Crisis Resources Alert */}
      {crisisResources && (
        <div className="border-b border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Support Resources
              </h3>
              <div className="mt-2 space-y-2">
                {crisisResources.map((resource, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium text-red-900">
                      {resource.name}
                    </span>
                    {resource.phone && (
                      <a
                        href={`tel:${resource.phone.replace(/\D/g, "")}`}
                        className="ml-2 text-red-700 underline"
                      >
                        {resource.phone}
                      </a>
                    )}
                    <p className="text-red-700">{resource.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              primaryColor={primaryColor}
            />
          ))}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-gray-100 px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-gray-50 p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={requestHandoff}
            disabled={isLoading || session?.handoffRequested || session?.crisisDetected}
            className="flex-1"
          >
            <Phone className="mr-2 h-4 w-4" />
            {session?.handoffRequested ? "Help is on the way" : "Talk to a person"}
          </Button>

          {isComplete && (
            <Button
              size="sm"
              onClick={completeIntake}
              disabled={isLoading}
              className="flex-1"
              style={{ backgroundColor: primaryColor }}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Submit Intake
            </Button>
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              session?.crisisDetected
                ? "We're here to support you..."
                : "Type your message..."
            }
            disabled={isLoading || !!completionMessage}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !!completionMessage}
            style={{ backgroundColor: input.trim() ? primaryColor : undefined }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Header component
function Header({
  orgName,
  logoUrl,
  primaryColor,
  onMinimize,
}: {
  orgName: string;
  logoUrl?: string;
  primaryColor: string;
  onMinimize: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 text-white"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={orgName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-4 w-4" />
          </div>
        )}
        <div>
          <h1 className="font-semibold">{orgName}</h1>
          <p className="text-xs text-white/80">Online</p>
        </div>
      </div>
      <button
        onClick={onMinimize}
        className="rounded-full p-1 hover:bg-white/10"
        aria-label="Minimize chat"
      >
        <MinusCircle className="h-5 w-5" />
      </button>
    </div>
  );
}

// Message bubble component
function MessageBubble({
  message,
  primaryColor,
}: {
  message: ChatMessage;
  primaryColor: string;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-gray-200" : ""
        }`}
        style={isUser ? undefined : { backgroundColor: primaryColor }}
      >
        {isUser ? (
          <User className="h-4 w-4 text-gray-600" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-tr-none bg-gray-100 text-gray-900"
            : "rounded-tl-none text-white"
        }`}
        style={isUser ? undefined : { backgroundColor: primaryColor }}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      </div>
    </div>
  );
}
