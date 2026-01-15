"use client";

import { useState, useEffect } from "react";
import { CreditCard, Calendar, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TIER_CONFIGS, type SubscriptionTier } from "@/lib/billing/types";

interface SubscriptionDetails {
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  formPacksRemaining: number;
}

export function SubscriptionCard() {
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      const response = await fetch("/api/billing/subscription");
      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.")) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (response.ok) {
        fetchDetails();
      }
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      if (response.ok) {
        fetchDetails();
      }
    } catch (error) {
      console.error("Failed to reactivate subscription:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!details) {
    return null;
  }

  const tierConfig = TIER_CONFIGS[details.tier];
  const isPaid = details.tier !== "FREE";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {tierConfig.name} Plan
            </CardTitle>
            <CardDescription>{tierConfig.description}</CardDescription>
          </div>
          <Badge
            variant={
              details.status === "active"
                ? "default"
                : details.status === "past_due"
                ? "destructive"
                : "secondary"
            }
          >
            {details.status === "active" && <CheckCircle className="h-3 w-3 mr-1" />}
            {details.status === "past_due" && <AlertCircle className="h-3 w-3 mr-1" />}
            {details.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cancellation warning */}
        {details.cancelAtPeriodEnd && details.currentPeriodEnd && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your subscription will cancel on{" "}
              {new Date(details.currentPeriodEnd).toLocaleDateString()}. You will be
              downgraded to the Free plan.
            </AlertDescription>
          </Alert>
        )}

        {/* Past due warning */}
        {details.status === "past_due" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your payment is past due. Please update your payment method to avoid
              service interruption.
            </AlertDescription>
          </Alert>
        )}

        {/* Plan details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {isPaid && details.currentPeriodEnd && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Next billing: {new Date(details.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}
          {details.formPacksRemaining > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">{details.formPacksRemaining}</span>
              <span className="text-muted-foreground">form packs remaining</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isPaid && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Manage Billing
            </Button>
          )}
          {isPaid && !details.cancelAtPeriodEnd && (
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleCancelSubscription}
              disabled={actionLoading}
            >
              Cancel Subscription
            </Button>
          )}
          {details.cancelAtPeriodEnd && (
            <Button
              variant="outline"
              onClick={handleReactivate}
              disabled={actionLoading}
            >
              Reactivate Subscription
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
