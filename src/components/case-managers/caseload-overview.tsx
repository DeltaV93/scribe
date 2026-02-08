"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface CaseManagerStat {
  id: string;
  name: string | null;
  currentCaseload: number;
  maxCaseload: number;
  utilizationPercent: number;
  spotsAvailable: number;
  availabilityStatus: string;
}

interface CaseloadStatistics {
  summary: {
    totalCaseManagers: number;
    available: number;
    atCapacity: number;
    unavailable: number;
    averageUtilization: number;
  };
  caseManagers: CaseManagerStat[];
}

interface CaseloadOverviewProps {
  compact?: boolean;
  onSelectCaseManager?: (id: string) => void;
}

export function CaseloadOverview({ compact = false, onSelectCaseManager }: CaseloadOverviewProps) {
  const [stats, setStats] = useState<CaseloadStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/case-managers/statistics");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else {
        toast.error("Failed to load caseload statistics");
      }
    } catch (error) {
      console.error("Error fetching caseload statistics:", error);
      toast.error("Failed to load caseload statistics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "LIMITED":
        return "bg-yellow-100 text-yellow-800";
      case "UNAVAILABLE":
        return "bg-red-100 text-red-800";
      case "ON_LEAVE":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return "text-red-600";
    if (percent >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const formatStatus = (status: string) =>
    status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Caseload Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Unable to load caseload statistics</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Capacity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchStats}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={stats.summary.averageUtilization} className="h-2" />
            </div>
            <span className={`text-sm font-medium ${getUtilizationColor(stats.summary.averageUtilization)}`}>
              {stats.summary.averageUtilization}% utilized
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{stats.summary.available} available</span>
            <span>{stats.summary.atCapacity} at capacity</span>
            <span>{stats.summary.unavailable} unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Caseload Overview
            </CardTitle>
            <CardDescription>Team capacity and availability at a glance</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold">{stats.summary.totalCaseManagers}</div>
          </div>

          <div className="p-4 rounded-lg bg-green-50">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Available</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{stats.summary.available}</div>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">At Capacity</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700">{stats.summary.atCapacity}</div>
          </div>

          <div className="p-4 rounded-lg bg-red-50">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">Unavailable</span>
            </div>
            <div className="text-2xl font-bold text-red-700">{stats.summary.unavailable}</div>
          </div>
        </div>

        {/* Average Utilization */}
        <div className="mb-6 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Average Team Utilization</span>
            <span className={`text-lg font-bold ${getUtilizationColor(stats.summary.averageUtilization)}`}>
              {stats.summary.averageUtilization}%
            </span>
          </div>
          <Progress value={stats.summary.averageUtilization} className="h-3" />
        </div>

        {/* Individual Case Managers */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Individual Caseloads</h4>

          {stats.caseManagers
            .sort((a, b) => b.utilizationPercent - a.utilizationPercent)
            .map((cm) => (
              <div
                key={cm.id}
                className={`p-3 rounded-lg border transition-colors ${
                  onSelectCaseManager ? "cursor-pointer hover:bg-muted/50" : ""
                }`}
                onClick={() => onSelectCaseManager?.(cm.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cm.name || "Unnamed"}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getAvailabilityColor(cm.availabilityStatus)}`}
                    >
                      {formatStatus(cm.availabilityStatus)}
                    </Badge>
                  </div>
                  <span className={`text-sm font-medium ${getUtilizationColor(cm.utilizationPercent)}`}>
                    {cm.currentCaseload}/{cm.maxCaseload}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={cm.utilizationPercent} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {cm.spotsAvailable > 0
                      ? `${cm.spotsAvailable} spots open`
                      : "Full"}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
