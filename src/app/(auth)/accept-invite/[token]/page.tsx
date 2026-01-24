"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, Building2, UserCircle } from "lucide-react";

interface InvitationData {
  email: string;
  name: string;
  role: string;
  organizationName: string;
  invitedBy: string;
  expiresAt: string;
}

type PageState = "loading" | "valid" | "invalid" | "submitting" | "success";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  // Validate invitation token on mount
  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/auth/validate-invite/${token}`);
        const data = await response.json();

        if (data.valid && data.invitation) {
          setInvitation(data.invitation);
          setName(data.invitation.name);
          setPageState("valid");
        } else {
          setError(data.error || "Invalid invitation");
          setPageState("invalid");
        }
      } catch {
        setError("Failed to validate invitation");
        setPageState("invalid");
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }

    setPageState("submitting");

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          name: name !== invitation?.name ? name : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPageState("success");
        // Redirect to login after short delay
        setTimeout(() => {
          router.push("/login?message=Account created successfully. Please sign in.");
        }, 2000);
      } else {
        setError(data.error || "Failed to create account");
        setPageState("valid");
      }
    } catch {
      setError("Failed to create account. Please try again.");
      setPageState("valid");
    }
  };

  // Loading state
  if (pageState === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Validating invitation...</p>
        </CardContent>
      </Card>
    );
  }

  // Invalid invitation state
  if (pageState === "invalid") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-destructive">
            Invalid Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <p className="text-muted-foreground text-sm">
            This invitation link may have expired or already been used. Please
            contact your administrator to request a new invitation.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Go to Sign In
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Success state
  if (pageState === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-xl font-semibold">Account Created!</h2>
          <p className="mt-2 text-muted-foreground text-center">
            Your account has been created successfully. Redirecting you to sign in...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Valid invitation - show signup form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Accept Invitation</CardTitle>
        <CardDescription>
          Complete your account setup to join {invitation?.organizationName}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Invitation details */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{invitation?.organizationName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <span>
                Invited by <span className="font-medium">{invitation?.invitedBy}</span>
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Role: <span className="font-medium">{formatRole(invitation?.role || "")}</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={invitation?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              This is the email address your invitation was sent to
            </p>
          </div>

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" required>
              Full Name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              required
              disabled={pageState === "submitting"}
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              disabled={pageState === "submitting"}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          {/* Confirm Password field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              disabled={pageState === "submitting"}
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
          <Button
            type="submit"
            className="w-full"
            disabled={pageState === "submitting"}
          >
            {pageState === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account & Join"
            )}
          </Button>
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

function formatRole(role: string): string {
  const roleNames: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrator",
    PROGRAM_MANAGER: "Program Manager",
    CASE_MANAGER: "Case Manager",
    VIEWER: "Viewer",
  };
  return roleNames[role] || role;
}
