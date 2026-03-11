"use client";

import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  confidence: number | null;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence == null) return null;

  const pct = Math.round(confidence * 100);
  const variant = pct >= 90 ? "success" : pct >= 70 ? "warning" : "destructive";

  return <Badge variant={variant}>{pct}%</Badge>;
}
