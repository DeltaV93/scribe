"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { AlertCircle, CheckCircle2, Copy, Loader2, Shield, Key } from "lucide-react";

type SetupStep = "loading" | "qr-code" | "verify" | "backup-codes" | "complete";

interface SetupData {
  qrCodeDataURL: string;
  manualEntryKey: string;
  secret: string;
}

export default function MFASetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>("loading");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize MFA setup on mount
  useEffect(() => {
    async function initSetup() {
      try {
        const response = await fetch("/api/auth/mfa/setup", {
          method: "POST",
        });

        const data = await response.json();

        if (!data.success) {
          if (data.error === "MFA is already enabled") {
            router.push("/dashboard/settings?tab=security");
            return;
          }
          setError(data.error);
          return;
        }

        setSetupData(data.data);
        setStep("qr-code");
      } catch {
        setError("Failed to initialize MFA setup. Please try again.");
      }
    }

    initSetup();
  }, [router]);

  // Handle verification code submission
  const handleVerify = async () => {
    if (!setupData || verificationCode.length !== 6) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: setupData.secret,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        setIsSubmitting(false);
        return;
      }

      setBackupCodes(data.data.backupCodes);
      setStep("backup-codes");
    } catch {
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy backup codes to clipboard
  const copyBackupCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy manual entry key
  const copyManualKey = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.manualEntryKey.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading state
  if (step === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !setupData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">MFA Setup Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // QR Code step
  if (step === "qr-code" && setupData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <Image
                src={setupData.qrCodeDataURL}
                alt="QR Code for authenticator app"
                width={200}
                height={200}
                className="w-[200px] h-[200px]"
              />
            </div>
          </div>

          {/* Manual entry key */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Or enter this code manually:
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md font-mono text-sm tracking-wider">
                {setupData.manualEntryKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyManualKey}
                title="Copy code"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Supported apps */}
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Supported authenticator apps:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
              <li>Microsoft Authenticator</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => setStep("verify")} className="w-full">
            Continue
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Verification step
  if (step === "verify") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Verify Your Authenticator
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleVerify}
            disabled={verificationCode.length !== 6 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify and Enable MFA"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setStep("qr-code")}
            className="w-full"
          >
            Back to QR Code
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Backup codes step
  if (step === "backup-codes") {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <Key className="h-6 w-6 text-success" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Save Your Backup Codes
          </CardTitle>
          <CardDescription>
            These codes can be used to access your account if you lose your
            authenticator device. Each code can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-warning/10 border border-warning/20 rounded-md p-4">
            <p className="text-sm text-warning-foreground font-medium">
              Important: Store these codes in a safe place. They will not be shown
              again.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="p-3 bg-muted rounded-md font-mono text-center text-sm"
              >
                {code}
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={copyBackupCodes} className="w-full">
            {copied ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy All Codes
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter>
          <Button onClick={() => setStep("complete")} className="w-full">
            I&apos;ve Saved My Backup Codes
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Complete step
  if (step === "complete") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <CardTitle className="text-2xl font-bold">MFA Enabled!</CardTitle>
          <CardDescription>
            Your account is now protected with two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>From now on, you will need to:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter your email and password</li>
              <li>Enter a code from your authenticator app</li>
            </ol>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Continue to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
