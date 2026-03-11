"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoalCard } from "./goal-card";
import { GoalStats } from "./goal-stats";
import { GoalFilters } from "./goal-filters";
import { GoalStatus, GoalType } from "@prisma/client";
import { Loader2, Plus, Target } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  ownerName: string | null;
  teamName: string | null;
  _count?: {
    grants: number;
    objectives: number;
    kpis: number;
    programs: number;
  };
}

export function GoalList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [type, setType] = useState<string>(searchParams.get("type") || "all");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  const fetchGoals = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (type && type !== "all") params.set("type", type);
      if (status && status !== "all") params.set("status", status);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/goals?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setGoals(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching goals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [search, type, status, pagination.page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleTypeChange = (value: string) => {
    setType(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearch("");
    setType("all");
    setStatus("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Calculate stats from current goals
  const stats = {
    total: pagination.total,
    onTrack: goals.filter((g) => g.status === GoalStatus.ON_TRACK).length,
    atRisk: goals.filter((g) => g.status === GoalStatus.AT_RISK || g.status === GoalStatus.BEHIND).length,
    completed: goals.filter((g) => g.status === GoalStatus.COMPLETED).length,
    averageProgress: goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <GoalStats stats={stats} />

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <GoalFilters
          search={search}
          onSearchChange={handleSearch}
          type={type}
          onTypeChange={handleTypeChange}
          status={status}
          onStatusChange={handleStatusChange}
          onClear={handleClearFilters}
        />
        <Button onClick={() => router.push("/goals/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Goal Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No goals found</h3>
          <p className="text-muted-foreground mb-4">
            {search || type !== "all" || status !== "all"
              ? "Try adjusting your filters"
              : "Get started by creating your first goal"}
          </p>
          {!search && type === "all" && status === "all" && (
            <Button onClick={() => router.push("/goals/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Goal
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => router.push(`/goals/${goal.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
