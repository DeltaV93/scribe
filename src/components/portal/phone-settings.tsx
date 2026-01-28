"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneVerificationModal } from "./phone-verification-modal";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PhoneSettingsProps {
  currentPhone: string;
  phoneDisplay: string;
  csrfToken: string | null;
  onPhoneChanged: () => void;
}

export function PhoneSettings({
  currentPhone,
  phoneDisplay,
  csrfToken,
  onPhoneChanged,
}: PhoneSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationData, setVerificationData] = useState<{
    verificationId: string;
    expiresAt: string;
  } | null>(null);

  const handleInitiateChange = async () => {
    if (!newPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    // Basic phone validation
    const digitsOnly = newPhone.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/portal/settings/phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ phone: digitsOnly }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationData({
          verificationId: data.data.verificationId,
          expiresAt: data.data.expiresAt,
        });
        toast.success("Verification code sent");
      } else {
        toast.error(data.error?.message || "Failed to send verification code");
      }
    } catch (error) {
      console.error("Error initiating phone change:", error);
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = () => {
    setVerificationData(null);
    setIsEditing(false);
    setNewPhone("");
    toast.success("Phone number updated. Please sign in again with your new number.");
    onPhoneChanged();
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number
          </CardTitle>
          <CardDescription>
            Your phone number is used for portal access and SMS notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              <p className="font-medium">{phoneDisplay}</p>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Change Phone Number
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-phone">New Phone Number</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="(555) 555-5555"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhoneInput(e.target.value))}
                  disabled={isSubmitting}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send a verification code to this number.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleInitiateChange}
                  disabled={isSubmitting || !newPhone.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Code"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setNewPhone("");
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {verificationData && (
        <PhoneVerificationModal
          open={true}
          onOpenChange={(open) => !open && setVerificationData(null)}
          verificationId={verificationData.verificationId}
          newPhone={newPhone.replace(/\D/g, "")}
          expiresAt={verificationData.expiresAt}
          csrfToken={csrfToken}
          onSuccess={handleVerificationSuccess}
        />
      )}
    </>
  );
}
