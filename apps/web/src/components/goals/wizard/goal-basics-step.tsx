"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalType } from "@prisma/client";
import { GoalFormData } from "./goal-wizard";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface GoalBasicsStepProps {
  formData: GoalFormData;
  onChange: (updates: Partial<GoalFormData>) => void;
}

const goalTypes = [
  { value: GoalType.GRANT, label: "Grant", description: "Track funder deliverables" },
  { value: GoalType.KPI, label: "KPI", description: "Key performance indicator" },
  { value: GoalType.OKR, label: "OKR", description: "Objective and key results" },
  { value: GoalType.PROGRAM_INITIATIVE, label: "Program Initiative", description: "Program-level goal" },
  { value: GoalType.TEAM_INITIATIVE, label: "Team Initiative", description: "Team-level goal" },
  { value: GoalType.INDIVIDUAL, label: "Individual", description: "Personal goal" },
];

export function GoalBasicsStep({ formData, onChange }: GoalBasicsStepProps) {
  return (
    <div className="space-y-6">
      {/* Goal Type */}
      <div className="space-y-2">
        <Label htmlFor="type">Goal Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => onChange({ type: value as GoalType })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {goalTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {type.description}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Goal Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Goal Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Enter a descriptive name for your goal"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Add details about this goal..."
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.startDate ? (
                  format(formData.startDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.startDate || undefined}
                onSelect={(date) => onChange({ startDate: date || null })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.endDate ? (
                  format(formData.endDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.endDate || undefined}
                onSelect={(date) => onChange({ endDate: date || null })}
                disabled={(date) =>
                  formData.startDate ? date < formData.startDate : false
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
