"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";

interface PhoneVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationId: string;
  newPhone: string;
  expiresAt: string;
  csrfToken: string | null;
  onSuccess: () => void;
}

export function PhoneVerificationModal({
  open,
  onOpenChange,
  verificationId,
  newPhone,
  expiresAt,
  csrfToken,
  onSuccess,
}: PhoneVerificationModalProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCode(["", "", "", "", "", ""]);
      setError(null);
      setRemainingAttempts(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredCode = code.join("");
    if (enteredCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/portal/settings/phone/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({
          verificationId,
          code: enteredCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();

        if (data.error.remainingAttempts !== undefined) {
          setRemainingAttempts(data.error.remainingAttempts);
        }
        setError(data.error.message || "Verification failed");
      }
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit when all digits entered
  useEffect(() => {
    if (code.every((d) => d !== "") && !isVerifying) {
      handleVerify();
    }
  }, [code]);

  // Format phone for display
  const formattedPhone = newPhone.length === 10
    ? `(${newPhone.slice(0, 3)}) ${newPhone.slice(3, 6)}-${newPhone.slice(6)}`
    : newPhone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Your New Number</DialogTitle>
          <DialogDescription>
            We sent a 6-digit code to {formattedPhone}. Enter it below to confirm your new phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isVerifying}
                className="w-10 h-12 text-center text-xl font-bold"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {remainingAttempts !== null && remainingAttempts > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} remaining
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={isVerifying || code.some((d) => d === "")}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isVerifying}
            >
              Cancel
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            The code expires in 10 minutes. If you don&apos;t receive it, close this and try again.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
