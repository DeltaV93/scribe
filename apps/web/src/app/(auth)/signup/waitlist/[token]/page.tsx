"use client";

import { useEffect, useState, useActionState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signUpFromWaitlist, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface TokenVerificationResult {
  valid: boolean;
  reason?: string;
  message?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
}

export default function WaitlistSignUpPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [verifying, setVerifying] = useState(true);
  const [tokenData, setTokenData] = useState<TokenVerificationResult | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const initialState: AuthState = {};
  const [state, formAction] = useActionState(signUpFromWaitlist, initialState);

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await fetch(`/api/waitlist/verify/${token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setTokenError(data.message || "Invalid or expired link.");
          setTokenData(null);
        } else {
          setTokenData(data);
          setTokenError(null);
        }
      } catch {
        setTokenError("Failed to verify link. Please try again.");
      } finally {
        setVerifying(false);
      }
    }

    if (token) {
      verifyToken();
    }
  }, [token]);

  // Redirect on successful signup
  useEffect(() => {
    if (state.success) {
      // Give user time to see success message
      const timer = setTimeout(() => {
        router.push("/login?message=account-created");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  if (verifying) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying your invitation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tokenError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Link Invalid</CardTitle>
          <CardDescription>
            We couldn&apos;t verify your invitation link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{tokenError}</span>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            Need help?{" "}
            <a href="mailto:support@inkra.io" className="text-primary hover:underline">
              Contact support
            </a>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
        <CardDescription>
          Welcome, {tokenData?.firstName}! Set up your password to get started.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        {/* Hidden token field */}
        <input type="hidden" name="token" value={token} />

        <CardContent className="space-y-4">
          {/* Success message */}
          {state.success && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{state.success}</span>
            </div>
          )}

          {/* Error messages */}
          {state.error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Pre-filled info (read-only display) */}
          <div className="rounded-md bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{tokenData?.firstName} {tokenData?.lastName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{tokenData?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{tokenData?.organization}</span>
            </div>
          </div>

          {/* Hidden fields for form submission */}
          <input type="hidden" name="email" value={tokenData?.email || ""} />
          <input type="hidden" name="name" value={`${tokenData?.firstName || ""} ${tokenData?.lastName || ""}`.trim()} />
          <input type="hidden" name="organizationName" value={tokenData?.organization || ""} />

          {/* Password field */}
          <div className="space-y-2">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              disabled={!!state.success}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          {/* Confirm password field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              disabled={!!state.success}
            />
          </div>

          {/* Terms agreement */}
          <p className="text-xs text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <SubmitButton
            className="w-full"
            pendingText="Creating account..."
            disabled={!!state.success}
          >
            {state.success ? "Account created!" : "Create account"}
          </SubmitButton>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
