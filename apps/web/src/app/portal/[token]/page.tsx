"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function PortalEntryPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { session, isLoading, error, pinVerified } = usePortalSession();

  useEffect(() => {
    if (!isLoading && !error) {
      // If PIN is required and not verified, redirect to PIN page
      if (session?.requiresPIN && !pinVerified) {
        router.replace(`/portal/${token}/pin`);
      } else {
        // Otherwise, redirect to messages
        router.replace(`/portal/${token}/messages`);
      }
    }
  }, [isLoading, error, session, pinVerified, token, router]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading your portal...</p>
        </CardContent>
      </Card>
    );
  }

  // While redirecting, show loading
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Redirecting...</p>
      </CardContent>
    </Card>
  );
}
