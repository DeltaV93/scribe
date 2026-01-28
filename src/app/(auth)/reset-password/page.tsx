"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword, type AuthState } from "@/lib/auth/actions";
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
import { useEffect } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const initialState: AuthState = {};
  const [state, formAction] = useActionState(resetPassword, initialState);

  // Redirect to login after successful password reset
  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.push("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
        <CardDescription>
          Enter your new password below
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {/* Success message */}
          {state.success && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{state.success} Redirecting to login...</span>
            </div>
          )}

          {/* Error messages */}
          {state.error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Password field */}
          <div className="space-y-2">
            <Label htmlFor="password" required>
              New Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your new password"
              autoComplete="new-password"
              required
              disabled={!!state.success}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <SubmitButton
            className="w-full"
            pendingText="Updating password..."
            disabled={!!state.success}
          >
            {state.success ? "Password updated" : "Update password"}
          </SubmitButton>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground text-center"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
