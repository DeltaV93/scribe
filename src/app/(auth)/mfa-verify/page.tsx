"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Shield, Key } from "lucide-react";

function MFAVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBackupCodeInput, setShowBackupCodeInput] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  if (!userId) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Invalid Request</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Missing user information. Please sign in again.</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const handleVerify = async () => {
    if (!code) return;

    setIsSubmitting(true);
    setError(null);
    setWarning(null);

    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          code: code.replace(/[-\s]/g, ""), // Normalize code
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        setIsSubmitting(false);
        return;
      }

      // Check for warnings
      if (data.data.warning) {
        setWarning(data.data.warning);
      }

      // Redirect to intended destination
      router.push(redirect);
    } catch {
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          {showBackupCodeInput ? (
            <Key className="h-6 w-6 text-primary" />
          ) : (
            <Shield className="h-6 w-6 text-primary" />
          )}
        </div>
        <CardTitle className="text-2xl font-bold">
          {showBackupCodeInput
            ? "Enter Backup Code"
            : "Two-Factor Authentication"}
        </CardTitle>
        <CardDescription>
          {showBackupCodeInput
            ? "Enter one of your backup codes"
            : "Enter the 6-digit code from your authenticator app"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {warning && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 text-warning-foreground text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="code">
            {showBackupCodeInput ? "Backup Code" : "Verification Code"}
          </Label>
          <Input
            id="code"
            type="text"
            inputMode={showBackupCodeInput ? "text" : "numeric"}
            pattern={showBackupCodeInput ? undefined : "[0-9]*"}
            maxLength={showBackupCodeInput ? 9 : 6}
            placeholder={showBackupCodeInput ? "XXXX-XXXX" : "000000"}
            value={code}
            onChange={(e) => {
              if (showBackupCodeInput) {
                // Allow alphanumeric and dashes for backup codes
                setCode(e.target.value.toUpperCase().slice(0, 9));
              } else {
                // Only numbers for TOTP
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }
            }}
            className={
              showBackupCodeInput
                ? "text-center text-lg tracking-wider font-mono uppercase"
                : "text-center text-2xl tracking-[0.5em] font-mono"
            }
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleVerify();
              }
            }}
          />
        </div>

        <Button
          onClick={handleVerify}
          disabled={
            isSubmitting ||
            (showBackupCodeInput ? code.length < 8 : code.length !== 6)
          }
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            setShowBackupCodeInput(!showBackupCodeInput);
            setCode("");
            setError(null);
          }}
          className="w-full"
        >
          {showBackupCodeInput
            ? "Use authenticator app instead"
            : "Use a backup code"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Lost access to your authenticator?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Contact support
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

function MFAVerifyFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>Loading...</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense fallback={<MFAVerifyFallback />}>
      <MFAVerifyForm />
    </Suspense>
  );
}
