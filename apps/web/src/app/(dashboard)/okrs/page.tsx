"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ObjectiveCard, ObjectiveForm, OKRTree } from "@/components/okrs";
import { ObjectiveStatus } from "@prisma/client";
import {
  Plus,
  Loader2,
  Target,
  TrendingUp,
  CheckCircle2,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";

interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  ownerName: string | null;
  ownerEmail: string;
  keyResults: Array<{
    id: string;
    title: string;
    progressPercentage: number;
  }>;
  childCount: number;
  children: Objective[];
}

interface Stats {
  totalObjectives: number;
  activeObjectives: number;
  completedObjectives: number;
  averageProgress: number;
}

export default function OKRsPage() {
  const router = useRouter();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [treeObjectives, setTreeObjectives] = useState<Objective[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchObjectives = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("parentId", "null"); // Only fetch root objectives
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      params.set("limit", "50");

      const response = await fetch(`/api/objectives?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setObjectives(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching objectives:", error);
    }
  }, [statusFilter, searchQuery]);

  const fetchTreeObjectives = async () => {
    try {
      const response = await fetch("/api/objectives?tree=true");
      if (response.ok) {
        const data = await response.json();
        setTreeObjectives(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching objective tree:", error);
    }
  };

  const fetchStats = async () => {
    try {
      // Calculate stats from objectives
      const allResponse = await fetch("/api/objectives?limit=250");
      if (allResponse.ok) {
        const data = await allResponse.json();
        const allObjectives = data.data || [];

        const active = allObjectives.filter(
          (o: Objective) => o.status === "ACTIVE"
        );
        const completed = allObjectives.filter(
          (o: Objective) => o.status === "COMPLETED"
        );
        const avgProgress =
          active.length > 0
            ? Math.round(
                active.reduce((sum: number, o: Objective) => sum + o.progress, 0) /
                  active.length
              )
            : 0;

        setStats({
          totalObjectives: allObjectives.length,
          activeObjectives: active.length,
          completedObjectives: completed.length,
          averageProgress: avgProgress,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchObjectives(),
        fetchTreeObjectives(),
        fetchStats(),
      ]);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading) {
      fetchObjectives();
    }
  }, [statusFilter, searchQuery, fetchObjectives, isLoading]);

  const handleObjectiveClick = (objectiveId: string) => {
    router.push(`/okrs/${objectiveId}`);
  };

  const handleSuccess = () => {
    fetchObjectives();
    fetchTreeObjectives();
    fetchStats();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OKRs</h1>
          <p className="text-muted-foreground">
            Track organizational objectives and key results.
          </p>
        </div>
        <Button onClick={() => setShowObjectiveForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Objective
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Objectives
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalObjectives}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeObjectives}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completedObjectives}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Progress
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageProgress}%</div>
              <p className="text-xs text-muted-foreground">of active objectives</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "grid" | "tree")}
        >
          <TabsList>
            <TabsTrigger value="grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="tree">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Objectives List */}
      {viewMode === "grid" ? (
        objectives.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No objectives yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-1">
                Create your first objective to start tracking organizational goals.
              </p>
              <Button
                className="mt-4"
                onClick={() => setShowObjectiveForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Objective
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {objectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                onClick={() => handleObjectiveClick(objective.id)}
              />
            ))}
          </div>
        )
      ) : (
        <OKRTree
          objectives={treeObjectives}
          onObjectiveClick={handleObjectiveClick}
        />
      )}

      {/* Objective Form Dialog */}
      <ObjectiveForm
        open={showObjectiveForm}
        onOpenChange={setShowObjectiveForm}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
