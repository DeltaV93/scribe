"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword, type AuthState } from "@/lib/auth/actions";
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
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const initialState: AuthState = {};
  const [state, formAction] = useActionState(forgotPassword, initialState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password
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

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={!!state.success}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <SubmitButton
            className="w-full"
            pendingText="Sending reset link..."
            disabled={!!state.success}
          >
            {state.success ? "Email sent" : "Send reset link"}
          </SubmitButton>
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
