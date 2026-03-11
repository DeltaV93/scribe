"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCheck, Check, Clock, AlertCircle, Send } from "lucide-react";

type MessageStatus = "DRAFT" | "SENT" | "DELIVERED" | "READ" | "FAILED";
type SmsDeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "UNDELIVERED" | "FAILED";

interface MessageStatusBadgeProps {
  status: MessageStatus;
  smsStatus?: SmsDeliveryStatus | null;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<
  MessageStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive"; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  SENT: {
    label: "Sent",
    variant: "default",
    icon: <Send className="h-3 w-3" />,
  },
  DELIVERED: {
    label: "Delivered",
    variant: "success",
    icon: <Check className="h-3 w-3" />,
  },
  READ: {
    label: "Read",
    variant: "success",
    icon: <CheckCheck className="h-3 w-3" />,
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

export function MessageStatusBadge({
  status,
  smsStatus,
  showLabel = true,
  className,
}: MessageStatusBadgeProps) {
  const config = statusConfig[status];

  // If SMS failed but message was sent, show warning
  const displayVariant =
    smsStatus === "FAILED" || smsStatus === "UNDELIVERED"
      ? "warning"
      : config.variant;

  return (
    <Badge variant={displayVariant} className={className}>
      <span className="flex items-center gap-1">
        {config.icon}
        {showLabel && <span>{config.label}</span>}
      </span>
    </Badge>
  );
}

interface SmsStatusIndicatorProps {
  status: SmsDeliveryStatus;
  className?: string;
}

const smsStatusConfig: Record<
  SmsDeliveryStatus,
  { label: string; color: string }
> = {
  QUEUED: { label: "SMS Queued", color: "text-muted-foreground" },
  SENT: { label: "SMS Sent", color: "text-blue-600" },
  DELIVERED: { label: "SMS Delivered", color: "text-green-600" },
  UNDELIVERED: { label: "SMS Undelivered", color: "text-yellow-600" },
  FAILED: { label: "SMS Failed", color: "text-red-600" },
};

export function SmsStatusIndicator({ status, className }: SmsStatusIndicatorProps) {
  const config = smsStatusConfig[status];

  return (
    <span className={`text-xs ${config.color} ${className || ""}`}>
      {config.label}
    </span>
  );
}
