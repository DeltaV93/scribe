"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Loader2, MessageSquare, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

interface MessageComposerProps {
  clientId: string;
  clientName: string;
  smsEnabled: boolean;
  onMessageSent?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessageComposer({
  clientId,
  clientName,
  smsEnabled,
  onMessageSent,
  open,
  onOpenChange,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [sendSms, setSendSms] = useState(smsEnabled);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/clients/${clientId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          sendSmsNotification: sendSms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to send message");
      }

      const data = await response.json();

      // Show success message with SMS status
      if (data.data.smsNotification?.success) {
        toast.success("Message sent with SMS notification");
      } else if (data.data.smsNotification?.skipped) {
        toast.success(`Message sent (SMS skipped: ${data.data.smsNotification.reason})`);
      } else if (sendSms && !data.data.smsNotification?.success) {
        toast.warning("Message sent but SMS notification failed");
      } else {
        toast.success("Message sent successfully");
      }

      setContent("");
      onOpenChange(false);
      onMessageSent?.();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Message to {clientName}
          </DialogTitle>
          <DialogDescription>
            Compose a message. The client will receive an SMS notification with a
            secure link to view the message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Type your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {content.length}/10000 characters
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sms-toggle" className="text-sm font-medium">
                SMS Notification
              </Label>
              <p className="text-xs text-muted-foreground">
                {smsEnabled
                  ? "Client will receive a text with a portal link"
                  : "Client has not opted in to SMS"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sendSms ? (
                <Bell className="h-4 w-4 text-green-600" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                id="sms-toggle"
                checked={sendSms}
                onCheckedChange={setSendSms}
                disabled={!smsEnabled || isSubmitting}
              />
            </div>
          </div>

          {!smsEnabled && (
            <p className="text-xs text-yellow-600">
              SMS notifications are disabled because the client has not opted in.
              You can enable SMS in the client&apos;s profile settings.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
