"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, Clock, TrendingUp, Loader2 } from "lucide-react";

interface ProgramStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  withdrawnEnrollments: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  totalHoursOffered: number;
  averageAttendanceRate: number;
}

interface ProgramStatsCardProps {
  programId: string;
}

export function ProgramStatsCard({ programId }: ProgramStatsCardProps) {
  const [stats, setStats] = useState<ProgramStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/programs/${programId}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [programId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      label: "Enrolled",
      value: stats.activeEnrollments,
      subtext: `${stats.completedEnrollments} completed`,
      icon: Users,
    },
    {
      label: "Sessions",
      value: stats.totalSessions,
      subtext: `${stats.completedSessions} completed`,
      icon: BookOpen,
    },
    {
      label: "Hours Offered",
      value: stats.totalHoursOffered,
      subtext: "total",
      icon: Clock,
    },
    {
      label: "Attendance",
      value: `${stats.averageAttendanceRate}%`,
      subtext: "average",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">
                  {item.label} <span className="text-muted-foreground/70">{item.subtext}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
