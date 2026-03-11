"use client";

import { Button } from "@/components/ui/button";
import { KeyResultStatusBadge } from "./key-result-status-badge";
import { OKRProgress } from "./okr-progress";
import { KeyResultStatus } from "@prisma/client";
import { Pencil, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyResultRowProps {
  keyResult: {
    id: string;
    title: string;
    description: string | null;
    targetValue: number;
    currentValue: number;
    startValue: number;
    unit: string | null;
    status: KeyResultStatus;
    progressPercentage: number;
  };
  onUpdateProgress?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function KeyResultRow({
  keyResult,
  onUpdateProgress,
  onEdit,
  className,
}: KeyResultRowProps) {
  const formatValue = (value: number) => {
    if (keyResult.unit === "%") {
      return `${value}%`;
    }
    if (keyResult.unit === "$") {
      return `$${value.toLocaleString()}`;
    }
    return keyResult.unit
      ? `${value.toLocaleString()} ${keyResult.unit}`
      : value.toLocaleString();
  };

  return (
    <div
      className={cn(
        "p-4 border rounded-lg hover:bg-muted/30 transition-colors",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{keyResult.title}</h4>
            <KeyResultStatusBadge status={keyResult.status} />
          </div>

          {keyResult.description && (
            <p className="text-sm text-muted-foreground">{keyResult.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {formatValue(keyResult.currentValue)} / {formatValue(keyResult.targetValue)}
            </span>
            {keyResult.startValue > 0 && (
              <span className="text-muted-foreground">
                (started at {formatValue(keyResult.startValue)})
              </span>
            )}
          </div>

          <OKRProgress
            value={keyResult.progressPercentage}
            size="sm"
            showLabel={false}
          />
        </div>

        <div className="flex items-center gap-2">
          {onUpdateProgress && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateProgress();
              }}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Update
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
