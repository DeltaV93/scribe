"use client";

/**
 * Coming Soon Integrations Section (PX-1003)
 *
 * Displays upcoming integrations with waitlist signup functionality.
 * Wave 2 and Wave 3 integrations shown as grayed out with waitlist option.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Bell, Check, Building2, Heart, Scale, Stethoscope, Users } from "lucide-react";

// ============================================
// Types
// ============================================

interface WaitlistStatus {
  platform: string;
  isOnWaitlist: boolean;
  waitlistCount: number;
}

interface PlatformConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: string;
  wave: 2 | 3;
}

// ============================================
// Platform Configuration
// ============================================

const COMING_SOON_PLATFORMS: PlatformConfig[] = [
  // Wave 2 - CRM & HR
  {
    id: "SALESFORCE",
    name: "Salesforce",
    description: "Sync meeting notes and follow-ups with Salesforce CRM.",
    icon: SalesforceIcon,
    color: "bg-[#00A1E0]",
    category: "CRM",
    wave: 2,
  },
  {
    id: "HUBSPOT",
    name: "HubSpot",
    description: "Log call summaries and action items to HubSpot CRM.",
    icon: HubSpotIcon,
    color: "bg-[#FF7A59]",
    category: "CRM",
    wave: 2,
  },
  {
    id: "BAMBOOHR",
    name: "BambooHR",
    description: "Sync HR meeting notes and documentation.",
    icon: ({ className }) => <Users className={className} />,
    color: "bg-[#73C41D]",
    category: "HR",
    wave: 2,
  },

  // Wave 3 - Industry Specific
  {
    id: "EPIC",
    name: "Epic",
    description: "Healthcare EHR integration for clinical documentation.",
    icon: ({ className }) => <Stethoscope className={className} />,
    color: "bg-[#1D3461]",
    category: "Healthcare",
    wave: 3,
  },
  {
    id: "CLIO",
    name: "Clio",
    description: "Legal practice management integration.",
    icon: ({ className }) => <Scale className={className} />,
    color: "bg-[#1B365D]",
    category: "Legal",
    wave: 3,
  },
  {
    id: "APRICOT",
    name: "Apricot",
    description: "Case management for nonprofits and social services.",
    icon: ({ className }) => <Heart className={className} />,
    color: "bg-[#FF9900]",
    category: "Nonprofit",
    wave: 3,
  },
];

// ============================================
// Main Component
// ============================================

export function ComingSoonSection() {
  const [waitlistStatuses, setWaitlistStatuses] = useState<WaitlistStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchWaitlistStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/waitlist");
      if (response.ok) {
        const data = await response.json();
        setWaitlistStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Failed to fetch waitlist statuses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitlistStatuses();
  }, [fetchWaitlistStatuses]);

  async function handleJoinWaitlist(platform: string) {
    setJoining(platform);

    try {
      const response = await fetch("/api/integrations/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const platformName = COMING_SOON_PLATFORMS.find((p) => p.id === platform)?.name || platform;
        toast({
          title: "Joined waitlist",
          description: `You'll be notified when ${platformName} is available.`,
        });
        fetchWaitlistStatuses();
      } else {
        throw new Error(data.error?.message || "Failed to join waitlist");
      }
    } catch (error) {
      console.error("Failed to join waitlist:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join waitlist",
        variant: "destructive",
      });
    } finally {
      setJoining(null);
    }
  }

  // Group platforms by wave
  const wave2Platforms = COMING_SOON_PLATFORMS.filter((p) => p.wave === 2);
  const wave3Platforms = COMING_SOON_PLATFORMS.filter((p) => p.wave === 3);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            Join the waitlist to be notified when these integrations are available
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="opacity-75">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Coming Soon</h3>
        <p className="text-sm text-muted-foreground">
          Join the waitlist to be notified when these integrations are available
        </p>
      </div>

      {/* Wave 2 - CRM & HR */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Building2 className="w-3 h-3 mr-1" />
            CRM & HR
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {wave2Platforms.map((config) => {
            const status = waitlistStatuses.find((s) => s.platform === config.id);
            const isOnWaitlist = status?.isOnWaitlist ?? false;
            const waitlistCount = status?.waitlistCount ?? 0;
            const isJoining = joining === config.id;
            const Icon = config.icon;

            return (
              <Card key={config.id} className="opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0 grayscale`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.name}
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {config.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button
                    variant={isOnWaitlist ? "secondary" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => handleJoinWaitlist(config.id)}
                    disabled={isJoining || isOnWaitlist}
                  >
                    {isOnWaitlist ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        On Waitlist
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </>
                    )}
                  </Button>
                  {waitlistCount > 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      {waitlistCount} {waitlistCount === 1 ? "person" : "people"} waiting
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Wave 3 - Industry Specific */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Stethoscope className="w-3 h-3 mr-1" />
            Industry-Specific
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {wave3Platforms.map((config) => {
            const status = waitlistStatuses.find((s) => s.platform === config.id);
            const isOnWaitlist = status?.isOnWaitlist ?? false;
            const waitlistCount = status?.waitlistCount ?? 0;
            const isJoining = joining === config.id;
            const Icon = config.icon;

            return (
              <Card key={config.id} className="opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0 grayscale`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.name}
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {config.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Button
                    variant={isOnWaitlist ? "secondary" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => handleJoinWaitlist(config.id)}
                    disabled={isJoining || isOnWaitlist}
                  >
                    {isOnWaitlist ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        On Waitlist
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </>
                    )}
                  </Button>
                  {waitlistCount > 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      {waitlistCount} {waitlistCount === 1 ? "person" : "people"} waiting
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Platform Icons
// ============================================

function SalesforceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.16 5.22c-.42 0-.81-.045-1.2-.135-.63 1.395-2.01 2.37-3.66 2.37a4.159 4.159 0 0 1-2.1-.555 4.11 4.11 0 0 1-3.99 3.18c-1.8 0-3.36-1.17-3.93-2.79a3.596 3.596 0 0 1-.72.075c-1.98 0-3.6-1.635-3.6-3.63 0-1.17.555-2.205 1.41-2.865-.255-.525-.405-1.11-.405-1.725 0-2.19 1.77-3.96 3.96-3.96.5 0 .974.092 1.41.262a4.19 4.19 0 0 1 3.99-3.116z" />
    </svg>
  );
}

function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.198 2.198 0 0 0 17.238.84h-.065a2.198 2.198 0 0 0-2.193 2.193v.066c0 .862.499 1.607 1.223 1.968v2.862a5.56 5.56 0 0 0-2.465 1.124l-6.574-5.12a2.282 2.282 0 0 0 .084-.59A2.29 2.29 0 1 0 4.96 5.63a2.29 2.29 0 0 0 .506-.057l6.448 5.023a5.6 5.6 0 0 0-.772 2.852 5.6 5.6 0 0 0 .81 2.912l-2.036 2.036a1.858 1.858 0 0 0-.537-.084 1.878 1.878 0 1 0 1.877 1.877c0-.188-.03-.37-.082-.54l2.016-2.016a5.577 5.577 0 0 0 3.093.934c3.09 0 5.595-2.504 5.595-5.594a5.577 5.577 0 0 0-3.714-5.263zm-.881 8.182a2.923 2.923 0 0 1-2.92-2.92 2.923 2.923 0 0 1 2.92-2.92 2.923 2.923 0 0 1 2.92 2.92 2.923 2.923 0 0 1-2.92 2.92z" />
    </svg>
  );
}
