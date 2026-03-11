"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function PINEntryPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { session, isLoading, pinVerified, setPinVerified, csrfToken } = usePortalSession();

  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already verified
  useEffect(() => {
    if (!isLoading && pinVerified) {
      router.replace(`/portal/${token}/messages`);
    }
  }, [isLoading, pinVerified, token, router]);

  // Redirect if no PIN required
  useEffect(() => {
    if (!isLoading && session && !session.requiresPIN) {
      setPinVerified(true);
      router.replace(`/portal/${token}/messages`);
    }
  }, [isLoading, session, setPinVerified, token, router]);

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(null);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 4);
    if (/^\d+$/.test(pastedData)) {
      const newPin = [...pin];
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i];
      }
      setPin(newPin);
      // Focus last filled input or next empty one
      const focusIndex = Math.min(pastedData.length, 3);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredPin = pin.join("");
    if (enteredPin.length !== 4) {
      setError("Please enter all 4 digits");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/portal/pin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();

      if (response.ok) {
        setPinVerified(true);
        router.replace(`/portal/${token}/messages`);
      } else {
        setPin(["", "", "", ""]);
        inputRefs.current[0]?.focus();

        if (data.error.lockedUntil) {
          setLockedUntil(new Date(data.error.lockedUntil));
          setError("Too many failed attempts. Account locked.");
        } else {
          setRemainingAttempts(data.error.remainingAttempts ?? null);
          setError(data.error.message || "Incorrect PIN");
        }
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Submit when all digits entered
  useEffect(() => {
    if (pin.every((d) => d !== "") && !isVerifying) {
      handleVerify();
    }
  }, [pin]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!session) return null;

  const isLocked = lockedUntil && lockedUntil > new Date();

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Enter Your PIN</CardTitle>
        <CardDescription>
          Welcome back, {session.client.firstName}. Please enter your 4-digit PIN to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {pin.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isVerifying || !!isLocked}
              className="w-14 h-14 text-center text-2xl font-bold"
              autoFocus={index === 0}
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

        {isLocked && lockedUntil && (
          <p className="text-center text-sm text-muted-foreground">
            Try again {formatDistanceToNow(lockedUntil, { addSuffix: true })}
          </p>
        )}

        <Button
          onClick={handleVerify}
          disabled={isVerifying || !!isLocked || pin.some((d) => d === "")}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify PIN"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Forgot your PIN? Contact your case manager for a new magic link.
        </p>
      </CardContent>
    </Card>
  );
}
