"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";

/**
 * Signup page - redirects to waitlist
 *
 * Account creation now requires waitlist approval.
 * This page informs users and directs them to the landing page waitlist form.
 */
export default function SignUpPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Clock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Join the Waitlist</CardTitle>
        <CardDescription>
          We&apos;re currently in private beta. Join our waitlist to get early access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
          <p className="font-medium">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Submit your details on our waitlist form</li>
            <li>We review applications in order</li>
            <li>You&apos;ll receive an email with your invite link</li>
            <li>Create your account and get started</li>
          </ol>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Already approved? Check your email for your personal invite link.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Link href="/#waitlist" className="w-full">
          <Button className="w-full">
            Join the Waitlist
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
