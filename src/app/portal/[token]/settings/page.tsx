"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { PhoneSettings } from "@/components/portal/phone-settings";
import { SmsSettings } from "@/components/portal/sms-settings";
import { PinSettings } from "@/components/portal/pin-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Settings, LogOut, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface SettingsData {
  phone: string;
  phoneDisplay: string;
  smsOptedIn: boolean;
  hasPIN: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { session, isLoading, pinVerified, csrfToken, logout } = usePortalSession();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Redirect if PIN verification is required
  useEffect(() => {
    if (!isLoading && session?.requiresPIN && !pinVerified) {
      router.replace(`/portal/${token}/pin`);
    }
  }, [isLoading, session, pinVerified, token, router]);

  // Fetch settings
  useEffect(() => {
    if (!isLoading && session && pinVerified) {
      fetchSettings();
    }
  }, [isLoading, session, pinVerified]);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/portal/settings", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      } else {
        toast.error("Failed to load settings");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handlePhoneChanged = () => {
    // Phone change invalidates all sessions, so redirect to expired
    router.push("/portal/expired");
  };

  const handleSmsUpdate = (optedIn: boolean) => {
    if (settings) {
      setSettings({ ...settings, smsOptedIn: optedIn });
    }
  };

  const handlePinUpdate = (hasPIN: boolean) => {
    if (settings) {
      setSettings({ ...settings, hasPIN });
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  if (isLoading || isLoadingSettings) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session || !settings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your account preferences
          </p>
        </div>
      </div>

      {/* Phone Settings */}
      <PhoneSettings
        currentPhone={settings.phone}
        phoneDisplay={settings.phoneDisplay}
        csrfToken={csrfToken}
        onPhoneChanged={handlePhoneChanged}
      />

      {/* SMS Settings */}
      <SmsSettings
        smsOptedIn={settings.smsOptedIn}
        csrfToken={csrfToken}
        onUpdate={handleSmsUpdate}
      />

      {/* PIN Settings */}
      <PinSettings
        hasPIN={settings.hasPIN}
        csrfToken={csrfToken}
        onUpdate={handlePinUpdate}
      />

      <Separator />

      {/* Help Link */}
      <Link href={`/portal/${token}/help`}>
        <Button variant="outline" className="w-full justify-start">
          <HelpCircle className="mr-2 h-4 w-4" />
          Help & FAQ
        </Button>
      </Link>

      {/* Logout */}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing out...
          </>
        ) : (
          <>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </>
        )}
      </Button>

      {/* Footer */}
      <p className="text-xs text-center text-muted-foreground">
        Signed in as {session.client.firstName} {session.client.lastName}
      </p>
    </div>
  );
}
