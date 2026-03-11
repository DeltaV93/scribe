"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface OrgSettings {
  id: string;
  name: string;
  preferredAreaCode: string | null;
  recordingRetentionDays: number;
  consentMode: string;
}

export function SettingsTab() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [areaCode, setAreaCode] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
        setAreaCode(data.data.preferredAreaCode || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredAreaCode: areaCode || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      toast.success("Settings saved");
      fetchSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Phone Number Settings</CardTitle>
          <CardDescription>
            Configure default settings for phone number provisioning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="areaCode">Preferred Area Code</Label>
            <Input
              id="areaCode"
              placeholder="e.g., 415"
              value={areaCode}
              onChange={(e) =>
                setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              maxLength={3}
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              New phone numbers will be purchased from this area code when
              available. Leave blank to use any available number.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Info</CardTitle>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Organization Name</Label>
              <p className="font-medium">{settings?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Recording Retention
              </Label>
              <p className="font-medium">
                {settings?.recordingRetentionDays} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
