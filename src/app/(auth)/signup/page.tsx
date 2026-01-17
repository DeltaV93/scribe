"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signUp, type AuthState } from "@/lib/auth/actions";
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
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const initialState: AuthState = {};
  const [state, formAction] = useFormState(signUp, initialState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your details to create your organization account
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
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

          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" required>
              Full Name
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Smith"
              autoComplete="name"
              required
              disabled={!!state.success}
            />
          </div>

          {/* Organization name field */}
          <div className="space-y-2">
            <Label htmlFor="organizationName" required>
              Organization Name
            </Label>
            <Input
              id="organizationName"
              name="organizationName"
              type="text"
              placeholder="Community Services Inc."
              required
              disabled={!!state.success}
            />
            <p className="text-xs text-muted-foreground">
              This is the name of your organization or agency
            </p>
          </div>

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="email" required>
              Work Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@organization.org"
              autoComplete="email"
              required
              disabled={!!state.success}
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
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              disabled={!!state.success}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
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
            {state.success ? "Check your email" : "Create account"}
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
