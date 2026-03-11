"use client";

/**
 * Feedback Stats Card
 *
 * Displays aggregate feedback statistics for a model.
 */

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Edit,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
} from "lucide-react";
import type { FeedbackStats as FeedbackStatsType } from "@/lib/ml-services";

interface FeedbackStatsProps {
  stats: FeedbackStatsType | null;
  isLoading?: boolean;
}

export function FeedbackStats({ stats, isLoading }: FeedbackStatsProps) {
  // Calculate trend from recent aggregates
  const trend = useMemo(() => {
    if (!stats || stats.aggregates.length < 2) return null;

    const recent = stats.aggregates.slice(0, Math.ceil(stats.aggregates.length / 2));
    const older = stats.aggregates.slice(Math.ceil(stats.aggregates.length / 2));

    const recentPositiveRate = recent.reduce((sum, a) => {
      const total = a.positive_count + a.negative_count;
      return sum + (total > 0 ? a.positive_count / total : 0);
    }, 0) / recent.length;

    const olderPositiveRate = older.reduce((sum, a) => {
      const total = a.positive_count + a.negative_count;
      return sum + (total > 0 ? a.positive_count / total : 0);
    }, 0) / older.length;

    const diff = recentPositiveRate - olderPositiveRate;

    if (diff > 0.05) return "up";
    if (diff < -0.05) return "down";
    return "stable";
  }, [stats]);

  // Calculate average rating across all aggregates with ratings
  const avgRating = useMemo(() => {
    if (!stats) return null;
    const aggregatesWithRatings = stats.aggregates.filter(
      (a) => a.rating_count > 0 && a.avg_rating !== null
    );
    if (aggregatesWithRatings.length === 0) return null;

    const totalRatingCount = aggregatesWithRatings.reduce(
      (sum, a) => sum + a.rating_count,
      0
    );
    const weightedSum = aggregatesWithRatings.reduce(
      (sum, a) => sum + (a.avg_rating || 0) * a.rating_count,
      0
    );
    return weightedSum / totalRatingCount;
  }, [stats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded w-full" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Statistics
          </CardTitle>
          <CardDescription>
            No feedback data available yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Feedback will appear here once users start providing it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Feedback Statistics
            </CardTitle>
            <CardDescription>
              {stats.total_feedback} total feedback submissions
            </CardDescription>
          </div>
          {trend && (
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`text-sm ${trendColor}`}>
                {trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Positive Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Positive Feedback Rate</span>
            <span className="text-sm font-medium">{stats.overall_positive_rate}%</span>
          </div>
          <Progress value={stats.overall_positive_rate} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.total_positive} positive</span>
            <span>{stats.total_negative} negative</span>
          </div>
        </div>

        {/* Average Rating */}
        {avgRating !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Average Rating</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(avgRating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Breakdown by Type */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-50">
            <ThumbsUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-green-700">{stats.total_positive}</p>
            <p className="text-xs text-green-600">Helpful</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-red-50">
            <ThumbsDown className="h-5 w-5 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-red-700">{stats.total_negative}</p>
            <p className="text-xs text-red-600">Not Helpful</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-blue-50">
            <Edit className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-blue-700">{stats.total_corrections}</p>
            <p className="text-xs text-blue-600">Corrections</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-semibold">{stats.total_feedback - stats.total_positive - stats.total_negative - stats.total_corrections}</p>
            <p className="text-xs text-muted-foreground">Comments</p>
          </div>
        </div>

        {/* Corrections Available */}
        {stats.total_corrections > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                {stats.total_corrections} corrections available for training
              </span>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Export
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
