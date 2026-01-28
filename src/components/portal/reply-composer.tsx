"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplyComposerProps {
  onSend: (content: string) => Promise<void>;
  csrfToken: string | null;
  disabled?: boolean;
}

const MAX_LENGTH = 2000;

export function ReplyComposer({ onSend, csrfToken, disabled }: ReplyComposerProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const canSend = content.trim().length > 0 && !isOverLimit && !isSending && !disabled;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      await onSend(content.trim());
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background p-3 space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isSending || disabled}
          className={cn(
            "w-full min-h-[44px] max-h-[200px] p-3 pr-12 rounded-2xl border resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "text-sm leading-relaxed",
            isOverLimit && "border-destructive focus:ring-destructive"
          )}
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span className={cn(isOverLimit && "text-destructive font-medium")}>
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
