import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check } from "lucide-react";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // TODO: Fetch actual billing data
  const currentTier: string = "STARTER";
  const formsUsed = 0;
  const formsLimit = 50;

  const tiers = [
    {
      name: "Starter",
      tier: "STARTER",
      price: "$49",
      period: "/month",
      description: "For small organizations getting started",
      features: [
        "50 form submissions/month",
        "5 intake forms",
        "Basic AI extraction",
        "Email support",
      ],
    },
    {
      name: "Professional",
      tier: "PRO",
      price: "$149",
      period: "/month",
      description: "For growing organizations",
      features: [
        "500 form submissions/month",
        "Unlimited intake forms",
        "Advanced AI extraction",
        "Priority support",
        "Custom branding",
      ],
    },
    {
      name: "Enterprise",
      tier: "ENTERPRISE",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "Unlimited submissions",
        "Unlimited forms",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee",
        "On-premise option",
      ],
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and purchase form packs.
        </p>
      </div>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            Your form submission usage this billing period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Form Submissions</span>
              <span className="text-sm text-muted-foreground">
                {formsUsed} / {formsLimit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(formsUsed / formsLimit) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Resets on the 1st of each month
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form Packs */}
      <Card>
        <CardHeader>
          <CardTitle>Form Packs</CardTitle>
          <CardDescription>
            Purchase additional form submissions that never expire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground mb-2">Forms</p>
              <p className="font-medium mb-4">$10</p>
              <Button variant="outline" size="sm" className="w-full">
                Purchase
              </Button>
            </div>
            <div className="border rounded-lg p-4 text-center border-primary">
              <Badge className="mb-2">Popular</Badge>
              <p className="text-2xl font-bold">10</p>
              <p className="text-sm text-muted-foreground mb-2">Forms</p>
              <p className="font-medium mb-4">$18</p>
              <Button size="sm" className="w-full">
                Purchase
              </Button>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">25</p>
              <p className="text-sm text-muted-foreground mb-2">Forms</p>
              <p className="font-medium mb-4">$40</p>
              <Button variant="outline" size="sm" className="w-full">
                Purchase
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tiers */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Subscription Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => {
            const isCurrent = tier.tier === currentTier;
            return (
              <Card
                key={tier.name}
                className={isCurrent ? "border-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{tier.name}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">{tier.period}</span>
                  </div>
                  <Separator className="my-4" />
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-4"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
