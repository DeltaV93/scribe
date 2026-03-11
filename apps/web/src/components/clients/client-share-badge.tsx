"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Edit, KeyRound, Users, Clock } from "lucide-react";
import { format } from "date-fns";

type Permission = "VIEW" | "EDIT" | "FULL";

interface ClientShareBadgeProps {
  permission: Permission;
  expiresAt?: string | null;
  compact?: boolean;
}

const PERMISSION_CONFIG: Record<
  Permission,
  {
    label: string;
    icon: typeof Eye;
    variant: "default" | "secondary" | "outline" | "success" | "warning";
    description: string;
  }
> = {
  VIEW: {
    label: "View",
    icon: Eye,
    variant: "secondary",
    description: "Can view client profile and history",
  },
  EDIT: {
    label: "Edit",
    icon: Edit,
    variant: "default",
    description: "Can view and edit client information",
  },
  FULL: {
    label: "Full",
    icon: KeyRound,
    variant: "success",
    description: "Full access to client data, calls, and notes",
  },
};

export function ClientShareBadge({
  permission,
  expiresAt,
  compact = false,
}: ClientShareBadgeProps) {
  const config = PERMISSION_CONFIG[permission];
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {!compact && config.label}
    </Badge>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label} Access</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {expiresAt && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires {format(new Date(expiresAt), "MMM d, yyyy")}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

interface SharedIndicatorProps {
  sharedByName?: string;
  permission: Permission;
  expiresAt?: string | null;
}

/**
 * A small indicator to show that the current user is accessing
 * a shared client (not their own assigned client)
 */
export function SharedIndicator({
  sharedByName,
  permission,
  expiresAt,
}: SharedIndicatorProps) {
  const isExpiringSoon = expiresAt
    ? new Date(expiresAt) <=
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    : false;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-accent rounded-md text-xs">
            <Users className="h-3 w-3" />
            <span>Shared with you</span>
            {isExpiringSoon && expiresAt && (
              <Clock className="h-3 w-3 text-warning" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Shared Client</p>
            {sharedByName && (
              <p className="text-xs text-muted-foreground">
                Shared by {sharedByName}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Permission:</span>
              <ClientShareBadge permission={permission} compact />
            </div>
            {expiresAt && (
              <p
                className={`text-xs ${
                  isExpiringSoon ? "text-warning" : "text-muted-foreground"
                }`}
              >
                {isExpiringSoon ? "Expires soon: " : "Expires: "}
                {format(new Date(expiresAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
