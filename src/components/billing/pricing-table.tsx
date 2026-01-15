"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TIER_CONFIGS, type SubscriptionTier } from "@/lib/billing/types";

interface PricingTableProps {
  currentTier?: SubscriptionTier;
  onSelectPlan?: (tier: SubscriptionTier, period: "monthly" | "yearly") => void;
}

export function PricingTable({ currentTier = "FREE", onSelectPlan }: PricingTableProps) {
  const [isYearly, setIsYearly] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (tier === "FREE" || tier === currentTier) return;

    setLoading(tier);
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          tier,
          billingPeriod: isYearly ? "yearly" : "monthly",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessionUrl) {
          window.location.href = data.sessionUrl;
        }
      }
    } catch (error) {
      console.error("Failed to create checkout:", error);
    } finally {
      setLoading(null);
    }
  };

  const tiers = Object.entries(TIER_CONFIGS) as [SubscriptionTier, typeof TIER_CONFIGS.FREE][];

  return (
    <div className="space-y-8">
      {/* Billing period toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-period" className={cn(!isYearly && "font-bold")}>
          Monthly
        </Label>
        <Switch
          id="billing-period"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label htmlFor="billing-period" className={cn(isYearly && "font-bold")}>
          Yearly
          <Badge variant="secondary" className="ml-2">
            Save 17%
          </Badge>
        </Label>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map(([tier, config]) => {
          const price = isYearly ? config.priceYearly : config.priceMonthly;
          const monthlyEquivalent = isYearly
            ? Math.round(config.priceYearly / 12)
            : config.priceMonthly;
          const isCurrentPlan = tier === currentTier;
          const isPopular = tier === "PROFESSIONAL";

          return (
            <Card
              key={tier}
              className={cn(
                "relative",
                isPopular && "border-primary shadow-lg",
                isCurrentPlan && "bg-muted/50"
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle>{config.name}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div>
                  {price === 0 ? (
                    <div className="text-4xl font-bold">Free</div>
                  ) : (
                    <>
                      <div className="text-4xl font-bold">
                        ${monthlyEquivalent}
                        <span className="text-lg font-normal text-muted-foreground">
                          /mo
                        </span>
                      </div>
                      {isYearly && (
                        <p className="text-sm text-muted-foreground">
                          ${price}/year billed annually
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : isPopular ? "default" : "secondary"}
                  disabled={isCurrentPlan || loading !== null}
                  onClick={() => handleSelectPlan(tier)}
                >
                  {loading === tier ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrentPlan
                    ? "Current Plan"
                    : tier === "FREE"
                    ? "Free Forever"
                    : "Upgrade"}
                </Button>

                {/* Features */}
                <ul className="space-y-2">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
