"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBadge({
  confidence,
  showLabel = false,
  size = "md",
}: ConfidenceBadgeProps) {
  const percentage = Math.round(confidence * 100);

  const getConfig = () => {
    if (confidence >= 0.9) {
      return {
        variant: "default" as const,
        icon: CheckCircle,
        label: "High confidence",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      };
    }
    if (confidence >= 0.7) {
      return {
        variant: "secondary" as const,
        icon: CheckCircle,
        label: "Good confidence",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      };
    }
    if (confidence >= 0.5) {
      return {
        variant: "outline" as const,
        icon: HelpCircle,
        label: "Medium confidence",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
      };
    }
    return {
      variant: "destructive" as const,
      icon: AlertCircle,
      label: "Low confidence",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    };
  };

  const config = getConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={config.variant}
            className={`gap-1 cursor-help ${config.bgColor}`}
          >
            <Icon className={`${sizeClasses[size]} ${config.color}`} />
            {showLabel && <span>{config.label}</span>}
            <span>{percentage}%</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
          <p className="text-xs text-muted-foreground">
            AI detection confidence: {percentage}%
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ConfidenceBarProps {
  confidence: number;
  showPercentage?: boolean;
}

export function ConfidenceBar({ confidence, showPercentage = true }: ConfidenceBarProps) {
  const percentage = Math.round(confidence * 100);

  const getColor = () => {
    if (confidence >= 0.9) return "bg-green-500";
    if (confidence >= 0.7) return "bg-blue-500";
    if (confidence >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-muted-foreground w-10 text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
}
