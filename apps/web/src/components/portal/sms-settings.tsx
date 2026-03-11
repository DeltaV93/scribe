"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SmsSettingsProps {
  smsOptedIn: boolean;
  csrfToken: string | null;
  onUpdate: (optedIn: boolean) => void;
}

export function SmsSettings({ smsOptedIn, csrfToken, onUpdate }: SmsSettingsProps) {
  const [isOptedIn, setIsOptedIn] = useState(smsOptedIn);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/portal/settings/sms", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ optedIn: checked }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsOptedIn(checked);
        onUpdate(checked);
        toast.success(data.message || (checked ? "SMS notifications enabled" : "SMS notifications disabled"));
      } else {
        toast.error(data.error?.message || "Failed to update preference");
      }
    } catch (error) {
      console.error("Error updating SMS preference:", error);
      toast.error("Something went wrong");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          SMS Notifications
        </CardTitle>
        <CardDescription>
          Receive text message alerts when your case manager sends you a new message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="sms-notifications" className="flex-1 cursor-pointer">
            <div className="font-medium">Enable SMS Notifications</div>
            <div className="text-sm text-muted-foreground">
              {isOptedIn
                ? "You will receive text alerts for new messages"
                : "You will not receive text alerts"}
            </div>
          </Label>
          {isUpdating ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="sms-notifications"
              checked={isOptedIn}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
