"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Users,
  HardDrive,
  Zap,
  Upload,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { UsageStats } from "@/lib/billing/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatLimit(value: number | "unlimited"): string {
  if (value === "unlimited") return "Unlimited";
  return value.toLocaleString();
}

function getPercentage(used: number, limit: number | "unlimited"): number {
  if (limit === "unlimited") return 0;
  return Math.min((used / limit) * 100, 100);
}

interface UsageItemProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | "unlimited";
  formatUsed?: (value: number) => string;
  formatLimit?: (value: number | "unlimited") => string;
}

function UsageItem({
  icon,
  label,
  used,
  limit,
  formatUsed = (v) => v.toLocaleString(),
  formatLimit: customFormatLimit = formatLimit,
}: UsageItemProps) {
  const percentage = getPercentage(used, limit);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 95;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{formatUsed(used)}</span>
            <span className="text-muted-foreground">
              of {customFormatLimit(limit)}
            </span>
          </div>
          {limit !== "unlimited" && (
            <Progress
              value={percentage}
              className={
                isDanger
                  ? "[&>div]:bg-red-500"
                  : isWarning
                  ? "[&>div]:bg-yellow-500"
                  : ""
              }
            />
          )}
          {limit === "unlimited" && (
            <div className="text-xs text-green-600">Unlimited usage</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UsageDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/billing/usage");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch usage stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load usage statistics
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Current Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageItem
          icon={<FileText className="h-4 w-4" />}
          label="Forms"
          used={stats.forms.used}
          limit={stats.forms.limit}
        />
        <UsageItem
          icon={<Send className="h-4 w-4" />}
          label="Submissions (this month)"
          used={stats.submissions.used}
          limit={stats.submissions.limit}
        />
        <UsageItem
          icon={<Users className="h-4 w-4" />}
          label="Team Members"
          used={stats.users.used}
          limit={stats.users.limit}
        />
        <UsageItem
          icon={<HardDrive className="h-4 w-4" />}
          label="Storage"
          used={stats.storage.used}
          limit={stats.storage.limit}
          formatUsed={formatBytes}
          formatLimit={(v) => (typeof v === "number" ? formatBytes(v) : "Unlimited")}
        />
        <UsageItem
          icon={<Zap className="h-4 w-4" />}
          label="AI Extractions (this month)"
          used={stats.aiExtractions.used}
          limit={stats.aiExtractions.limit}
        />
        <UsageItem
          icon={<Upload className="h-4 w-4" />}
          label="File Uploads (this month)"
          used={stats.fileUploads.used}
          limit={stats.fileUploads.limit}
        />
      </div>
    </div>
  );
}
