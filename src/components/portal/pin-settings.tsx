"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PinSettingsProps {
  hasPIN: boolean;
  csrfToken: string | null;
  onUpdate: (hasPIN: boolean) => void;
}

export function PinSettings({ hasPIN, csrfToken, onUpdate }: PinSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePinChange = (
    index: number,
    value: string,
    isConfirm: boolean
  ) => {
    if (value && !/^\d$/.test(value)) return;

    const setter = isConfirm ? setConfirmPin : setPin;
    const current = isConfirm ? confirmPin : pin;
    const refs = isConfirm ? confirmRefs : pinRefs;

    const newPin = [...current];
    newPin[index] = value;
    setter(newPin);
    setError(null);

    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }

    // Auto-advance to confirm step
    if (!isConfirm && index === 3 && value) {
      setTimeout(() => {
        setStep("confirm");
        confirmRefs.current[0]?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    isConfirm: boolean
  ) => {
    const current = isConfirm ? confirmPin : pin;
    const refs = isConfirm ? confirmRefs : pinRefs;

    if (e.key === "Backspace" && !current[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleSavePIN = async () => {
    const enteredPin = pin.join("");
    const enteredConfirm = confirmPin.join("");

    if (enteredPin.length !== 4) {
      setError("Please enter all 4 digits");
      return;
    }

    if (enteredPin !== enteredConfirm) {
      setError("PINs do not match");
      setConfirmPin(["", "", "", ""]);
      setStep("confirm");
      confirmRefs.current[0]?.focus();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/portal/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("PIN has been set");
        onUpdate(true);
        resetForm();
      } else {
        setError(data.error?.message || "Failed to set PIN");
      }
    } catch (error) {
      console.error("Error setting PIN:", error);
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePIN = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/portal/pin", {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
      });

      if (response.ok) {
        toast.success("PIN has been removed");
        onUpdate(false);
      } else {
        const data = await response.json();
        toast.error(data.error?.message || "Failed to remove PIN");
      }
    } catch (error) {
      console.error("Error removing PIN:", error);
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setPin(["", "", "", ""]);
    setConfirmPin(["", "", "", ""]);
    setStep("enter");
    setError(null);
  };

  const renderPinInputs = (
    values: string[],
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    isConfirm: boolean
  ) => (
    <div className="flex justify-center gap-2">
      {values.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handlePinChange(index, e.target.value, isConfirm)}
          onKeyDown={(e) => handleKeyDown(index, e, isConfirm)}
          disabled={isSubmitting}
          className="w-12 h-12 text-center text-xl font-bold"
        />
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Security PIN
        </CardTitle>
        <CardDescription>
          {hasPIN
            ? "You have a PIN set for extra security when returning to the portal."
            : "Set a 4-digit PIN for extra security when returning to the portal."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasPIN ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">PIN is set</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No PIN set</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setTimeout(() => pinRefs.current[0]?.focus(), 100);
                }}
              >
                {hasPIN ? "Change PIN" : "Set PIN"}
              </Button>
              {hasPIN && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePIN}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Remove"
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className={cn(step === "enter" ? "" : "text-muted-foreground")}>
                {step === "enter" ? "Enter new PIN" : "PIN entered"}
              </Label>
              {step === "enter" ? (
                renderPinInputs(pin, pinRefs, false)
              ) : (
                <div className="flex justify-center gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-12 h-12 flex items-center justify-center border rounded-md bg-muted"
                    >
                      <span className="text-xl">*</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {step === "confirm" && (
              <div className="space-y-3">
                <Label>Confirm PIN</Label>
                {renderPinInputs(confirmPin, confirmRefs, true)}
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {step === "confirm" && (
                <Button
                  onClick={handleSavePIN}
                  disabled={isSubmitting || confirmPin.some((d) => d === "")}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save PIN"
                  )}
                </Button>
              )}
              <Button variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
