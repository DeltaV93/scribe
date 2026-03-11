"use client";

import { Badge } from "@/components/ui/badge";
import { ConsentStatus } from "@prisma/client";
import { Mic, MicOff, HelpCircle } from "lucide-react";

interface ConsentBadgeProps {
  status: ConsentStatus;
  showIcon?: boolean;
  onClick?: () => void;
}

const statusConfig: Record<
  ConsentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    icon: typeof Mic;
  }
> = {
  GRANTED: {
    label: "Recording Consent",
    variant: "success",
    icon: Mic,
  },
  REVOKED: {
    label: "Opted Out",
    variant: "warning",
    icon: MicOff,
  },
  PENDING: {
    label: "No Consent",
    variant: "outline",
    icon: HelpCircle,
  },
};

export function ConsentBadge({ status, showIcon = true, onClick }: ConsentBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={onClick ? "cursor-pointer hover:opacity-80" : ""}
      onClick={onClick}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
