"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConsentBadge } from "./consent-badge";
import { ConsentStatus, ConsentCollectionMethod } from "@prisma/client";
import { Shield, Clock, User, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ConsentRecord {
  status: ConsentStatus;
  grantedAt: string | null;
  revokedAt: string | null;
  method: ConsentCollectionMethod | null;
  revokedBy?: {
    id: string;
    name: string;
  } | null;
}

interface ConsentSectionProps {
  clientId: string;
  clientName: string;
  consent: ConsentRecord | null;
  onConsentRevoked?: () => void;
}

const methodLabels: Record<ConsentCollectionMethod, string> = {
  KEYPRESS: "Phone keypress",
  VERBAL: "Verbal consent",
  WRITTEN: "Written consent",
  SILENCE_TIMEOUT: "Stayed on line",
};

export function ConsentSection({
  clientId,
  clientName,
  consent,
  onConsentRevoked,
}: ConsentSectionProps) {
  const [isRevoking, setIsRevoking] = useState(false);

  const status = consent?.status || ConsentStatus.PENDING;
  const hasConsent = status === ConsentStatus.GRANTED;
  const isRevoked = status === ConsentStatus.REVOKED;

  const handleRevokeConsent = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/consent/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to revoke consent");
      }

      toast.success("Consent revoked", {
        description: "Future calls with this client will not be recorded.",
      });

      onConsentRevoked?.();
    } catch (error) {
      console.error("Error revoking consent:", error);
      toast.error("Failed to revoke consent", {
        description: "Please try again.",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Recording Consent</CardTitle>
          </div>
          <ConsentBadge status={status} />
        </div>
        <CardDescription>
          Consent status for call recording and transcription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status details */}
        {hasConsent && consent?.grantedAt && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Granted:</span>
              <span>{format(new Date(consent.grantedAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            {consent.method && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Method:</span>
                <span>{methodLabels[consent.method]}</span>
              </div>
            )}
          </div>
        )}

        {isRevoked && consent?.revokedAt && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span>This client has opted out of call recording.</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Revoked:</span>
              <span>{format(new Date(consent.revokedAt), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            {consent.revokedBy && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">By:</span>
                <span>{consent.revokedBy.name}</span>
              </div>
            )}
          </div>
        )}

        {status === ConsentStatus.PENDING && (
          <div className="text-sm text-muted-foreground">
            No consent on file. Consent will be requested during the next call.
          </div>
        )}

        {/* Actions */}
        {hasConsent && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-2">
                Revoke Consent
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke Recording Consent</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to revoke recording consent for {clientName}?
                  <br /><br />
                  <strong>This will:</strong>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>Disable recording for all future calls with this client</li>
                    <li>Queue existing recordings for deletion (30-day retention)</li>
                    <li>Require manual documentation for future calls</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeConsent}
                  disabled={isRevoking}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isRevoking ? "Revoking..." : "Revoke Consent"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
