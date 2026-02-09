"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Target, ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";

interface LinkedOKR {
  objectiveId: string;
  objectiveTitle: string;
  progress: number;
  keyResultCount: number;
  completedKeyResults: number;
}

interface OKRProgressWidgetProps {
  okrs: LinkedOKR[];
  className?: string;
  showTitle?: boolean;
  maxItems?: number;
}

function getProgressColor(progress: number): string {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 75) return "bg-blue-500";
  if (progress >= 50) return "bg-yellow-500";
  if (progress >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function OKRItem({ okr }: { okr: LinkedOKR }) {
  const isComplete = okr.progress >= 100;

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Target className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{okr.objectiveTitle}</p>
            <p className="text-xs text-muted-foreground">
              {okr.completedKeyResults}/{okr.keyResultCount} Key Results
            </p>
          </div>
        </div>
        {isComplete && (
          <Badge variant="outline" className="bg-green-500/10 gap-1 shrink-0">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-green-500 text-xs">Complete</span>
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Progress value={okr.progress} className="h-2 flex-1">
          <div
            className={cn("h-full rounded-full transition-all", getProgressColor(okr.progress))}
            style={{ width: `${Math.min(100, okr.progress)}%` }}
          />
        </Progress>
        <span className="text-sm font-medium w-12 text-right">{Math.round(okr.progress)}%</span>
      </div>
    </div>
  );
}

export function OKRProgressWidget({
  okrs,
  className,
  showTitle = true,
  maxItems = 5,
}: OKRProgressWidgetProps) {
  const displayedOKRs = okrs.slice(0, maxItems);
  const hasMore = okrs.length > maxItems;

  // Calculate overall progress
  const overallProgress =
    okrs.length > 0
      ? Math.round(okrs.reduce((sum, okr) => sum + okr.progress, 0) / okrs.length)
      : 0;

  if (okrs.length === 0) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              My OKRs
            </CardTitle>
            <CardDescription>Track your objectives and key results</CardDescription>
          </CardHeader>
        )}
        <CardContent className="flex flex-col items-center justify-center h-[200px] gap-4">
          <Target className="h-12 w-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No objectives assigned</p>
            <Button variant="outline" asChild>
              <Link href="/objectives">View All Objectives</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                My OKRs
              </CardTitle>
              <CardDescription>
                {okrs.length} objective{okrs.length !== 1 ? "s" : ""} - {overallProgress}% overall
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/objectives" className="gap-1">
                View All
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("space-y-2", !showTitle && "pt-6")}>
        {displayedOKRs.map((okr) => (
          <Link
            key={okr.objectiveId}
            href={`/objectives/${okr.objectiveId}`}
            className="block"
          >
            <OKRItem okr={okr} />
          </Link>
        ))}

        {hasMore && (
          <p className="text-center text-sm text-muted-foreground pt-2">
            +{okrs.length - maxItems} more objective{okrs.length - maxItems !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
