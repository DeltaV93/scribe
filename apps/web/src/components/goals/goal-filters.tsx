"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalStatus, GoalType } from "@prisma/client";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoalFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClear?: () => void;
}

export function GoalFilters({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  onClear,
}: GoalFiltersProps) {
  const hasFilters = search || type !== "all" || status !== "all";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search goals..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value={GoalType.GRANT}>Grants</SelectItem>
          <SelectItem value={GoalType.KPI}>KPIs</SelectItem>
          <SelectItem value={GoalType.OKR}>OKRs</SelectItem>
          <SelectItem value={GoalType.PROGRAM_INITIATIVE}>Program</SelectItem>
          <SelectItem value={GoalType.TEAM_INITIATIVE}>Team</SelectItem>
          <SelectItem value={GoalType.INDIVIDUAL}>Individual</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value={GoalStatus.NOT_STARTED}>Not Started</SelectItem>
          <SelectItem value={GoalStatus.IN_PROGRESS}>In Progress</SelectItem>
          <SelectItem value={GoalStatus.ON_TRACK}>On Track</SelectItem>
          <SelectItem value={GoalStatus.AT_RISK}>At Risk</SelectItem>
          <SelectItem value={GoalStatus.BEHIND}>Behind</SelectItem>
          <SelectItem value={GoalStatus.COMPLETED}>Completed</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && onClear && (
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
