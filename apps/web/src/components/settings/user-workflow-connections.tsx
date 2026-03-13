"use client";

/**
 * User Workflow Connections Component (PX-882)
 *
 * Allows users to connect their own accounts to workflow platforms
 * (Linear, Notion, Jira) that have been enabled by their admin.
 *
 * Key features:
 * - Shows only platforms enabled by admin
 * - Users connect with their own OAuth credentials
 * - Tasks they create appear under their name in the external system
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";

// ============================================
// Types
// ============================================

type WorkflowPlatform = "LINEAR" | "NOTION" | "JIRA";

interface PlatformStatus {
  platform: WorkflowPlatform;
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  connection: {
    id: string;
    status: string;
    externalUserName: string | null;
    lastUsedAt: string | null;
    lastError: string | null;
    connectedAt: string | null;
  } | null;
}

interface PlatformConfig {
  id: WorkflowPlatform;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ============================================
// Platform Configuration
// ============================================

const WORKFLOW_PLATFORMS: PlatformConfig[] = [
  {
    id: "LINEAR",
    name: "Linear",
    description:
      "Push action items and tasks to Linear. Creates issues under your account.",
    icon: LinearIcon,
    color: "bg-[#5E6AD2]",
  },
  {
    id: "NOTION",
    name: "Notion",
    description:
      "Push meeting notes and documents to Notion. Creates pages in your workspace.",
    icon: NotionIcon,
    color: "bg-[#000000]",
  },
  {
    id: "JIRA",
    name: "Jira",
    description:
      "Push action items to Jira. Creates issues under your account.",
    icon: JiraIcon,
    color: "bg-[#0052CC]",
  },
];

// ============================================
// Main Component
// ============================================

export function UserWorkflowConnections() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<WorkflowPlatform | null>(null);
  const [disconnecting, setDisconnecting] = useState<WorkflowPlatform | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [platformToDisconnect, setPlatformToDisconnect] = useState<WorkflowPlatform | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const fetchPlatforms = useCallback(async () => {
    try {
      const response = await fetch("/api/user/integrations");
      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms);
      }
    } catch (error) {
      console.error("Failed to fetch user integrations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  // Handle OAuth callback params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const platform = searchParams.get("platform");

    if (success === "true" && platform) {
      const platformName =
        WORKFLOW_PLATFORMS.find((p) => p.id.toLowerCase() === platform.toLowerCase())?.name ||
        platform;

      toast({
        title: "Connected successfully",
        description: `Your ${platformName} account has been connected.`,
      });
      router.replace("/settings");
      fetchPlatforms();
    } else if (error && platform) {
      const platformName =
        WORKFLOW_PLATFORMS.find((p) => p.id.toLowerCase() === platform.toLowerCase())?.name ||
        platform;

      toast({
        title: `${platformName} connection failed`,
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      router.replace("/settings");
    }
  }, [searchParams, router, toast, fetchPlatforms]);

  async function handleConnect(platform: WorkflowPlatform) {
    setConnecting(platform);

    try {
      const response = await fetch(
        `/api/user/integrations/${platform.toLowerCase()}/authorize?redirectUrl=/settings`
      );
      const data = await response.json();

      if (response.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error(data.error?.message || "Failed to start authorization");
      }
    } catch (error) {
      console.error("Failed to initiate OAuth:", error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
      setConnecting(null);
    }
  }

  async function handleDisconnect(platform: WorkflowPlatform) {
    setDisconnecting(platform);

    try {
      const response = await fetch(`/api/user/integrations/${platform.toLowerCase()}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const platformName = WORKFLOW_PLATFORMS.find((p) => p.id === platform)?.name || platform;
        toast({
          title: "Disconnected",
          description: `Your ${platformName} account has been disconnected.`,
        });
        fetchPlatforms();
      } else {
        throw new Error(data.error?.message || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
      setShowDisconnectDialog(false);
      setPlatformToDisconnect(null);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Filter to only show enabled platforms
  const enabledPlatforms = platforms.filter((p) => p.enabled);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Integrations</CardTitle>
          <CardDescription>
            Connect your accounts to push action items and notes to external platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No platforms enabled
  if (enabledPlatforms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Integrations</CardTitle>
          <CardDescription>
            Connect your accounts to push action items and notes to external platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p>No workflow platforms are enabled for your organization.</p>
            <p className="text-sm mt-1">
              Contact your admin to enable Linear, Notion, or Jira.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My Integrations</CardTitle>
          <CardDescription>
            Connect your accounts to push action items and notes to external platforms.
            Tasks will be created under your name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {enabledPlatforms.map((status) => {
              const config = WORKFLOW_PLATFORMS.find((p) => p.id === status.platform);
              if (!config) return null;

              const isConnected = status.connected;
              const isConnecting = connecting === status.platform;
              const isDisconnecting = disconnecting === status.platform;
              const Icon = config.icon;

              return (
                <div
                  key={status.platform}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{config.name}</h4>
                      {isConnected ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {config.description}
                    </p>

                    {isConnected && status.connection && (
                      <div className="mt-2 text-sm space-y-1">
                        {status.connection.externalUserName && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="w-3.5 h-3.5" />
                            <span>Connected as {status.connection.externalUserName}</span>
                          </div>
                        )}
                        {status.connection.lastUsedAt && (
                          <div className="text-muted-foreground">
                            Last used: {formatDate(status.connection.lastUsedAt)}
                          </div>
                        )}
                        {status.connection.lastError && (
                          <div className="flex items-start gap-1.5 text-destructive">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                            <span>{status.connection.lastError}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPlatformToDisconnect(status.platform);
                          setShowDisconnectDialog(true);
                        }}
                        disabled={isDisconnecting}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {isDisconnecting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Disconnecting
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(status.platform)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Connecting
                          </>
                        ) : (
                          "Connect"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your{" "}
              {platformToDisconnect
                ? WORKFLOW_PLATFORMS.find((p) => p.id === platformToDisconnect)?.name
                : ""}
              {" "}account? You will no longer be able to push items to this platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => platformToDisconnect && handleDisconnect(platformToDisconnect)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================
// Platform Icons
// ============================================

function LinearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor">
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765-21.5387-5.4981-37.5744-24.5916-37.2512-37.2319zM.00189 46.8891C-.0628 40.0866 1.62809 33.5738 4.73853 27.8889c.4279-.7826 1.41844-.9451 2.08397-.3605l52.62861 46.286c.6655.5847.5302 1.6348-.2395 2.0754-5.8105 3.3262-12.5147 5.2227-19.6671 5.2227C17.3299 81.1305 0.232892 65.4634.00189 46.8891zM75.7471 78.0978c.5601.6468 1.5702.5959 2.0566-.0847 6.3568-8.8908 10.0998-19.7787 10.0998-31.5667 0-29.9052-24.2382-54.1433-54.1433-54.1433-11.7879 0-22.6758 3.74297-31.5666 10.0999-.68063.4864-.73181 1.4965-.08472 2.0565L75.7471 78.0978zM99.8088 46.8891c.0628 6.8025-1.6281 13.3153-4.7386 18.9999-.4279.7826-1.4184.9455-2.084.3605l-52.6286-46.286c-.6655-.5847-.5302-1.6348.2395-2.0754C46.405 14.5519 53.1092 12.6554 60.2616 12.6554c22.2157 0 39.3129 15.6671 39.5472 34.2337z" />
    </svg>
  );
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor">
      <path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fillRule="evenodd" />
      <path
        d="M61.35.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L75.64 3.67C71.203.58 69.49.193 62.69.773l-1.34-.546z"
        fill="#fff"
        fillRule="evenodd"
      />
      <path
        d="M27.133 18.173c-5.437.39-6.69.483-9.803-1.947L9.063 9.823c-.783-.587-.39-1.363.783-1.457l54.363-3.887c4.467-.387 6.8.97 8.543 2.333l9.413 6.803c.39.193.973 1.067.193 1.067l-56.117 3.397-.097.097v-.003z"
        fill="#000"
        fillRule="evenodd"
      />
      <path d="M19.8 88.6V26.127c0-1.557.483-2.33 1.94-2.43l56.357-3.397c1.357-.1 1.94.78 1.94 2.33V83.74c0 1.553-.29 2.913-2.53 3.1l-53.78 3.21c-2.237.193-3.927-.583-3.927-2.45V88.6z" fill="#fff" fillRule="evenodd" />
      <path
        d="M66.733 32.327c.2 1.067 0 2.137-1.067 2.233l-2.723.483v41.7c-2.333 1.263-4.47 1.943-6.217 1.943-2.913 0-3.69-.97-5.887-3.69l-18.043-28.437v27.533l5.637 1.263s0 2.137-2.917 2.137l-8.153.483c-.2-.967 0-2.43 1.263-2.72l3.3-.877V38.54l-4.567-.39c-.2-1.067.39-2.623 2.137-2.72l8.737-.583 18.813 28.827V38.34l-4.763-.487c-.2-1.263.677-2.137 1.75-2.233l8.703-.293z"
        fill="#000"
        fillRule="evenodd"
      />
    </svg>
  );
}

function JiraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
    </svg>
  );
}
