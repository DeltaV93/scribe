"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

interface GoalStatsProps {
  stats: {
    total: number;
    onTrack: number;
    atRisk: number;
    completed: number;
    averageProgress: number;
  };
}

export function GoalStats({ stats }: GoalStatsProps) {
  const statItems = [
    {
      label: "Total Goals",
      value: stats.total,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "On Track",
      value: stats.onTrack,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "At Risk",
      value: stats.atRisk,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
