"use client";

/**
 * Version Table
 *
 * Displays a table of model versions with deploy/rollback actions.
 * Includes confirmation dialogs, progress indicators, and responsive design.
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
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Rocket,
  RotateCcw,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertTriangle,
  Archive,
  Loader2,
  Layers,
  Calendar,
  Info,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ModelVersion, VersionStatus } from "@/lib/ml-services";
import { DeployVersionDialog } from "./DeployVersionDialog";
import {
  RollbackConfirmDialog,
  useConfirmDialog,
} from "./ConfirmDialog";

interface VersionTableProps {
  modelId: string;
  versions: ModelVersion[];
  isLoading?: boolean;
  onDeploy?: (versionNumber: number, environment: "staging" | "production", trafficPercentage: number) => Promise<void>;
  onRollback?: (versionNumber: number, environment: "staging" | "production") => Promise<void>;
}

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}

const STATUS_CONFIG: Record<VersionStatus, StatusConfig> = {
  training: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950/50",
    label: "Training",
    description: "Model is currently being trained",
  },
  validating: {
    icon: <Clock className="h-3 w-3" />,
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-950/50",
    label: "Validating",
    description: "Running validation checks on the model",
  },
  ready: {
    icon: <CheckCircle className="h-3 w-3" />,
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-950/50",
    label: "Ready",
    description: "Model is ready to be deployed",
  },
  deployed: {
    icon: <Rocket className="h-3 w-3" />,
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-950/50",
    label: "Deployed",
    description: "Model is currently serving traffic",
  },
  deprecated: {
    icon: <Archive className="h-3 w-3" />,
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    label: "Deprecated",
    description: "Model version is no longer recommended",
  },
};

/**
 * Skeleton loader for table view
 */
function TableSkeleton() {
  return (
    <div className="border rounded-lg" role="status" aria-label="Loading versions">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Created</TableHead>
            <TableHead className="hidden md:table-cell">Deployed</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-5 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24 rounded-full" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading version data...</span>
    </div>
  );
}

/**
 * Skeleton loader for card view (mobile)
 */
function CardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading versions">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
      <span className="sr-only">Loading version data...</span>
    </div>
  );
}

/**
 * Empty state when no versions exist
 */
function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg"
      role="status"
      aria-label="No versions"
    >
      <div className="p-4 rounded-full bg-muted mb-4">
        <Layers className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No versions yet</h3>
      <p className="text-muted-foreground text-center max-w-sm">
        Create your first version to start training and deploying this model.
      </p>
    </div>
  );
}

/**
 * Status badge with tooltip
 */
function StatusBadge({ status }: { status: VersionStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`gap-1 ${config.bgColor} ${config.color} border-0`}
          >
            {config.icon}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Training progress indicator
 */
function TrainingProgress({ version }: { version: ModelVersion }) {
  // Simulate progress based on time elapsed (in real app, this would come from metrics)
  const progress = version.metrics?.training_progress as number | undefined;

  if (version.status !== "training" || progress === undefined) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Training progress</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

/**
 * Mobile card view for a single version
 */
function VersionCard({
  version,
  canDeploy,
  canRollback,
  isActionLoading,
  onDeployClick,
  onRollbackClick,
}: {
  version: ModelVersion;
  canDeploy: boolean;
  canRollback: boolean;
  isActionLoading: boolean;
  onDeployClick: () => void;
  onRollbackClick: (environment: "staging" | "production") => void;
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-lg">v{version.version_number}</CardTitle>
          <StatusBadge status={version.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            <span>Created {formatDate(version.created_at)}</span>
          </div>
          {version.deployed_at && (
            <div className="flex items-center gap-1">
              <Rocket className="h-3 w-3" aria-hidden="true" />
              <span>Deployed {formatDate(version.deployed_at)}</span>
            </div>
          )}
        </div>

        <TrainingProgress version={version} />

        <div className="flex gap-2 mt-3">
          {canDeploy && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDeployClick}
              disabled={isActionLoading}
              className="flex-1"
            >
              <Rocket className="h-4 w-4 mr-1" />
              Deploy
            </Button>
          )}
          {canRollback && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isActionLoading}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Rollback
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onRollbackClick("staging")}>
                  To Staging
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRollbackClick("production")}>
                  To Production
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VersionTable({
  modelId,
  versions,
  isLoading,
  onDeploy,
  onRollback,
}: VersionTableProps) {
  const [deployingVersion, setDeployingVersion] = useState<ModelVersion | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Rollback confirmation state
  const rollbackDialog = useConfirmDialog<{
    version: ModelVersion;
    environment: "staging" | "production";
  }>();

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

  const initiateRollback = (version: ModelVersion, environment: "staging" | "production") => {
    rollbackDialog.open({ version, environment });
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackDialog.data || !onRollback) return;

    const { version, environment } = rollbackDialog.data;
    setActionLoading(`rollback-${version.version_number}`);
    try {
      await onRollback(version.version_number, environment);
      rollbackDialog.close();
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

  // Loading state
  if (isLoading) {
    return isMobile ? <CardSkeleton /> : <TableSkeleton />;
  }

  // Empty state
  if (versions.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Mobile Card View */}
      {isMobile && (
        <div className="space-y-4" role="list" aria-label="Version list">
          {versions.map((version) => {
            const isActionLoading = actionLoading?.includes(String(version.version_number));
            return (
              <div key={version.id} role="listitem">
                <VersionCard
                  version={version}
                  canDeploy={canDeploy(version)}
                  canRollback={canRollback(version)}
                  isActionLoading={!!isActionLoading}
                  onDeployClick={() => setDeployingVersion(version)}
                  onRollbackClick={(env) => initiateRollback(version, env)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Table View */}
      {!isMobile && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">Deployed</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => {
                const isVersionActionLoading = actionLoading?.includes(String(version.version_number));

                return (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div>
                        <span className="font-mono font-medium">
                          v{version.version_number}
                        </span>
                        <TrainingProgress version={version} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={version.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {formatDate(version.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {formatDate(version.deployed_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isVersionActionLoading}
                            aria-label={`Actions for version ${version.version_number}`}
                          >
                            {isVersionActionLoading ? (
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
                              <Rocket className="h-4 w-4 mr-2" aria-hidden="true" />
                              Deploy
                            </DropdownMenuItem>
                          )}
                          {canRollback(version) && (
                            <>
                              {canDeploy(version) && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                onClick={() => initiateRollback(version, "staging")}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                                Rollback to Staging
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => initiateRollback(version, "production")}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                                Rollback to Production
                              </DropdownMenuItem>
                            </>
                          )}
                          {!canDeploy(version) && !canRollback(version) && (
                            <DropdownMenuItem disabled>
                              <Info className="h-4 w-4 mr-2" aria-hidden="true" />
                              No actions available
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground mt-4" role="status" aria-live="polite">
        {versions.length} version{versions.length !== 1 ? "s" : ""}
      </p>

      {/* Deploy Dialog */}
      <DeployVersionDialog
        open={!!deployingVersion}
        onOpenChange={(open) => !open && setDeployingVersion(null)}
        versionNumber={deployingVersion?.version_number || 0}
        onDeploy={handleDeploy}
        isLoading={actionLoading?.startsWith("deploy")}
      />

      {/* Rollback Confirmation Dialog */}
      <RollbackConfirmDialog
        open={rollbackDialog.isOpen}
        onOpenChange={rollbackDialog.setOpen}
        versionNumber={rollbackDialog.data?.version.version_number || 0}
        environment={rollbackDialog.data?.environment || "staging"}
        onConfirm={handleRollbackConfirm}
        isLoading={actionLoading?.startsWith("rollback")}
      />
    </>
  );
}
