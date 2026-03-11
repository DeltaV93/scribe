"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SmsPreference {
  optedIn: boolean;
  phoneNumber: string | null;
  optInMethod: string | null;
  optedInAt: string | null;
}

interface SmsPreferenceCardProps {
  clientId: string;
  clientPhone: string;
  onPreferenceChange?: (optedIn: boolean) => void;
}

export function SmsPreferenceCard({
  clientId,
  clientPhone,
  onPreferenceChange,
}: SmsPreferenceCardProps) {
  const [preference, setPreference] = useState<SmsPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [optInMethod, setOptInMethod] = useState<"verbal" | "written" | "portal">("verbal");

  useEffect(() => {
    fetchPreference();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchPreference = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/sms-preference`);
      if (response.ok) {
        const data = await response.json();
        setPreference(data.data);
        setPhoneNumber(data.data.phoneNumber || clientPhone || "");
      }
    } catch (error) {
      console.error("Error fetching SMS preference:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (optedIn: boolean) => {
    if (optedIn && !phoneNumber) {
      toast.error("Please enter a phone number first");
      setEditMode(true);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/clients/${clientId}/sms-preference`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optedIn,
          phoneNumber: phoneNumber || clientPhone,
          optInMethod,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preference");
      }

      const data = await response.json();
      setPreference(data.data);
      onPreferenceChange?.(optedIn);
      toast.success(optedIn ? "SMS notifications enabled" : "SMS notifications disabled");
      setEditMode(false);
    } catch (error) {
      console.error("Error updating SMS preference:", error);
      toast.error("Failed to update SMS preference");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/clients/${clientId}/sms-preference`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optedIn: preference?.optedIn || false,
          phoneNumber,
          optInMethod,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update preference");
      }

      const data = await response.json();
      setPreference(data.data);
      toast.success("SMS settings saved");
      setEditMode(false);
    } catch (error) {
      console.error("Error updating SMS preference:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle className="text-base">SMS Notifications</CardTitle>
          </div>
          {preference?.optedIn ? (
            <Badge variant="success" className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Disabled
            </Badge>
          )}
        </div>
        <CardDescription>
          When enabled, the client receives an SMS when you send them a message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sms-opt-in">Receive SMS notifications</Label>
            <p className="text-xs text-muted-foreground">
              {preference?.optedInAt
                ? `Opted in on ${format(new Date(preference.optedInAt), "MMM d, yyyy")}`
                : "Not yet opted in"}
            </p>
          </div>
          <Switch
            id="sms-opt-in"
            checked={preference?.optedIn || false}
            onCheckedChange={handleToggle}
            disabled={isSaving}
          />
        </div>

        {(editMode || !preference?.phoneNumber) && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opt-in-method">Consent Method</Label>
              <Select
                value={optInMethod}
                onValueChange={(value) => setOptInMethod(value as "verbal" | "written" | "portal")}
                disabled={isSaving}
              >
                <SelectTrigger id="opt-in-method">
                  <SelectValue placeholder="Select consent method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verbal">Verbal consent</SelectItem>
                  <SelectItem value="written">Written consent</SelectItem>
                  <SelectItem value="portal">Portal opt-in</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Document how the client provided consent for HIPAA compliance.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !phoneNumber}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
              {editMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditMode(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {!editMode && preference?.phoneNumber && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Phone: </span>
                {preference.phoneNumber}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditMode(true)}
              >
                Edit
              </Button>
            </div>
            {preference.optInMethod && (
              <p className="text-xs text-muted-foreground mt-1">
                Consent: {preference.optInMethod}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
