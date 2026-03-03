"use client";

/**
 * Version Table
 *
 * Displays a table of model versions with deploy/rollback actions.
 */

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Rocket,
  RotateCcw,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertTriangle,
  Archive,
  Loader2,
} from "lucide-react";
import type { ModelVersion, VersionStatus } from "@/lib/ml-services";
import { DeployVersionDialog } from "./DeployVersionDialog";

interface VersionTableProps {
  modelId: string;
  versions: ModelVersion[];
  isLoading?: boolean;
  onDeploy?: (versionNumber: number, environment: "staging" | "production", trafficPercentage: number) => Promise<void>;
  onRollback?: (versionNumber: number, environment: "staging" | "production") => Promise<void>;
}

const STATUS_CONFIG: Record<VersionStatus, { icon: React.ReactNode; color: string; label: string }> = {
  training: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "bg-blue-100 text-blue-800",
    label: "Training",
  },
  validating: {
    icon: <Clock className="h-3 w-3" />,
    color: "bg-yellow-100 text-yellow-800",
    label: "Validating",
  },
  ready: {
    icon: <CheckCircle className="h-3 w-3" />,
    color: "bg-green-100 text-green-800",
    label: "Ready",
  },
  deployed: {
    icon: <Rocket className="h-3 w-3" />,
    color: "bg-purple-100 text-purple-800",
    label: "Deployed",
  },
  deprecated: {
    icon: <Archive className="h-3 w-3" />,
    color: "bg-gray-100 text-gray-800",
    label: "Deprecated",
  },
};

export function VersionTable({
  modelId,
  versions,
  isLoading,
  onDeploy,
  onRollback,
}: VersionTableProps) {
  const [deployingVersion, setDeployingVersion] = useState<ModelVersion | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDeploy = async (
    environment: "staging" | "production",
    trafficPercentage: number
  ) => {
    if (!deployingVersion || !onDeploy) return;

    setActionLoading(`deploy-${deployingVersion.version_number}`);
    try {
      await onDeploy(deployingVersion.version_number, environment, trafficPercentage);
      setDeployingVersion(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async (version: ModelVersion, environment: "staging" | "production") => {
    if (!onRollback) return;

    setActionLoading(`rollback-${version.version_number}`);
    try {
      await onRollback(version.version_number, environment);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const canDeploy = (version: ModelVersion) => {
    return version.status === "ready" || version.status === "deployed";
  };

  const canRollback = (version: ModelVersion) => {
    return version.status === "ready" || version.status === "deployed";
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Deployed</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Deployed</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <p className="text-muted-foreground">No versions yet</p>
                </TableCell>
              </TableRow>
            ) : (
              versions.map((version) => {
                const config = STATUS_CONFIG[version.status];
                const isActionLoading = actionLoading?.includes(String(version.version_number));

                return (
                  <TableRow key={version.id}>
                    <TableCell>
                      <span className="font-mono font-medium">
                        v{version.version_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`gap-1 ${config.color}`}>
                        {config.icon}
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(version.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(version.deployed_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canDeploy(version) && (
                            <DropdownMenuItem
                              onClick={() => setDeployingVersion(version)}
                            >
                              <Rocket className="h-4 w-4 mr-2" />
                              Deploy
                            </DropdownMenuItem>
                          )}
                          {canRollback(version) && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRollback(version, "staging")}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Rollback to Staging
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRollback(version, "production")}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Rollback to Production
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeployVersionDialog
        open={!!deployingVersion}
        onOpenChange={(open) => !open && setDeployingVersion(null)}
        versionNumber={deployingVersion?.version_number || 0}
        onDeploy={handleDeploy}
        isLoading={actionLoading?.startsWith("deploy")}
      />
    </>
  );
}
