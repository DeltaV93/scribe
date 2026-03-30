"use client";

/**
 * Reusable Integration Card (PX-1002)
 *
 * Generic card component for displaying integrations with consistent styling.
 * Supports connected, available, and coming soon states.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  Loader2,
  Bell,
} from "lucide-react";

// ============================================
// Types
// ============================================

export interface IntegrationCardProps {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;

  // State
  status: "available" | "connected" | "coming_soon" | "not_configured";
  enabled?: boolean;
  connectedUsers?: number;

  // Actions
  onConnect?: () => void;
  onDisconnect?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onJoinWaitlist?: () => void;

  // Loading states
  isConnecting?: boolean;
  isToggling?: boolean;
  isOnWaitlist?: boolean;

  // Optional
  setupGuideUrl?: string;
  externalAccountName?: string;
}

// ============================================
// Component
// ============================================

export function IntegrationCard({
  name,
  description,
  icon: Icon,
  color,
  status,
  enabled,
  connectedUsers,
  onConnect,
  onDisconnect,
  onToggleEnabled,
  onJoinWaitlist,
  isConnecting,
  isToggling,
  isOnWaitlist,
  setupGuideUrl,
  externalAccountName,
}: IntegrationCardProps) {
  const isComingSoon = status === "coming_soon";
  const isNotConfigured = status === "not_configured";

  return (
    <Card className={`relative ${isComingSoon ? "opacity-75" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0 ${
              isComingSoon ? "grayscale" : ""
            }`}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {name}
              {isComingSoon && (
                <Badge variant="secondary" className="text-xs">
                  Coming Soon
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Not Configured State */}
        {isNotConfigured && (
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Not configured</p>
                <p className="mt-1">
                  OAuth credentials not set.{" "}
                  {setupGuideUrl && (
                    <a
                      href={setupGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline"
                    >
                      Setup guide <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Coming Soon State */}
        {isComingSoon && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onJoinWaitlist}
            disabled={isOnWaitlist}
          >
            {isOnWaitlist ? (
              <>
                <Bell className="w-4 h-4 mr-2" />
                On Waitlist
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Join Waitlist
              </>
            )}
          </Button>
        )}

        {/* Available State (Admin Toggle) */}
        {status === "available" && onToggleEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {enabled ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={onToggleEnabled}
                disabled={isToggling}
              />
            </div>

            {enabled && connectedUsers !== undefined && connectedUsers > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>
                  {connectedUsers} user{connectedUsers !== 1 ? "s" : ""} connected
                </span>
              </div>
            )}

            {enabled && connectedUsers === 0 && (
              <p className="text-xs text-muted-foreground">
                No users have connected yet.
              </p>
            )}
          </>
        )}

        {/* Connected State (User View) */}
        {status === "connected" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              </div>
            </div>

            {externalAccountName && (
              <p className="text-xs text-muted-foreground">
                Connected as {externalAccountName}
              </p>
            )}

            {onDisconnect && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onDisconnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            )}
          </>
        )}

        {/* Available State (User Connect) */}
        {status === "available" && onConnect && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
