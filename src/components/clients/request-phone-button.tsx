"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Phone, Clock } from "lucide-react";
import { toast } from "sonner";

interface RequestPhoneButtonProps {
  hasPendingRequest?: boolean;
  requestId?: string | null;
  onRequestCreated?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function RequestPhoneButton({
  hasPendingRequest = false,
  requestId,
  onRequestCreated,
  variant = "default",
  size = "default",
  className,
}: RequestPhoneButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isPending, setIsPending] = useState(hasPendingRequest);
  const [currentRequestId, setCurrentRequestId] = useState(requestId);

  const handleRequest = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/phone-requests", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      const data = await response.json();
      setIsPending(true);
      setCurrentRequestId(data.data.id);
      setShowDialog(false);
      toast.success("Phone number request submitted! An admin will review it shortly.");
      onRequestCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!currentRequestId) return;

    setIsCanceling(true);
    try {
      const response = await fetch(`/api/phone-requests/${currentRequestId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel request");
      }

      setIsPending(false);
      setCurrentRequestId(null);
      toast.success("Request canceled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel request");
    } finally {
      setIsCanceling(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size={size} className={className} disabled>
          <Clock className="h-4 w-4 mr-2" />
          Request Pending
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isCanceling}
        >
          {isCanceling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Cancel"
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowDialog(true)}
      >
        <Phone className="h-4 w-4 mr-2" />
        Request Phone Number
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a Phone Number</DialogTitle>
            <DialogDescription>
              To make calls to clients, you need a phone number assigned to your
              account. Submit a request and an administrator will assign one to
              you.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Once approved, you&apos;ll receive an email notification and will
              be able to make calls from your client profiles.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleRequest} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
