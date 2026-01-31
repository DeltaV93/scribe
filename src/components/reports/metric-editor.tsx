"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MetricFilter {
  field: string;
  operator: string;
  value: string;
}

interface MetricEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseMetric?: {
    id: string;
    name: string;
    description: string;
    category: string;
    calculation: Record<string, unknown>;
  };
  onSave: (metric: { name: string; description: string; calculation: Record<string, unknown> }) => Promise<void>;
}

const OPERATORS = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less Than or Equal" },
  { value: "in", label: "In List" },
  { value: "contains", label: "Contains" },
];

const DATA_SOURCES = [
  { value: "clients", label: "Clients" },
  { value: "enrollments", label: "Program Enrollments" },
  { value: "attendance", label: "Attendance Records" },
  { value: "submissions", label: "Form Submissions" },
  { value: "notes", label: "Notes" },
  { value: "calls", label: "Calls" },
];

const AGGREGATIONS = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "percentage", label: "Percentage" },
  { value: "median", label: "Median" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

export function MetricEditor({
  open,
  onOpenChange,
  baseMetric,
  onSave,
}: MetricEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(baseMetric?.name || "");
  const [description, setDescription] = useState(baseMetric?.description || "");
  const [dataSource, setDataSource] = useState(
    (baseMetric?.calculation?.dataSource as string) || "clients"
  );
  const [aggregation, setAggregation] = useState(
    (baseMetric?.calculation?.aggregation as string) || "count"
  );
  const [field, setField] = useState(
    (baseMetric?.calculation?.field as string) || ""
  );
  const [filters, setFilters] = useState<MetricFilter[]>(
    ((baseMetric?.calculation?.filters as MetricFilter[]) || []).map((f) => ({
      field: f.field,
      operator: f.operator,
      value: typeof f.value === "string" ? f.value : JSON.stringify(f.value),
    }))
  );

  const addFilter = () => {
    setFilters([...filters, { field: "", operator: "eq", value: "" }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<MetricFilter>) => {
    setFilters(
      filters.map((f, i) => (i === index ? { ...f, ...updates } : f))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a metric name");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsSaving(true);
    try {
      const calculation: Record<string, unknown> = {
        dataSource,
        aggregation,
      };

      if (field) {
        calculation.field = field;
      }

      if (filters.length > 0) {
        calculation.filters = filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value.includes(",")
            ? f.value.split(",").map((v) => v.trim())
            : f.value,
        }));
      }

      await onSave({
        name: name.trim(),
        description: description.trim(),
        calculation,
      });

      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save metric");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {baseMetric ? "Customize Metric" : "Create Custom Metric"}
          </DialogTitle>
          <DialogDescription>
            {baseMetric
              ? `Customize "${baseMetric.name}" for your needs`
              : "Define a new custom metric for your reports"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Metric Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Total Veterans Served"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this metric measures"
                rows={2}
              />
            </div>
          </div>

          {/* Calculation Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Source</Label>
                  <Select value={dataSource} onValueChange={setDataSource}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aggregation</Label>
                  <Select value={aggregation} onValueChange={setAggregation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGGREGATIONS.map((agg) => (
                        <SelectItem key={agg.value} value={agg.value}>
                          {agg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(aggregation === "sum" ||
                aggregation === "average" ||
                aggregation === "median" ||
                aggregation === "min" ||
                aggregation === "max") && (
                <div className="space-y-2">
                  <Label>Field to Aggregate</Label>
                  <Input
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    placeholder="e.g., hoursAttended"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Filters</CardTitle>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No filters applied. Click "Add Filter" to narrow down the data.
                </p>
              ) : (
                <div className="space-y-3">
                  {filters.map((filter, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={filter.field}
                        onChange={(e) =>
                          updateFilter(index, { field: e.target.value })
                        }
                        placeholder="Field"
                        className="w-32"
                      />
                      <Select
                        value={filter.operator}
                        onValueChange={(value) =>
                          updateFilter(index, { operator: value })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={filter.value}
                        onChange={(e) =>
                          updateFilter(index, { value: e.target.value })
                        }
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilter(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Calculate the{" "}
                <Badge variant="outline">{aggregation}</Badge> of{" "}
                <Badge variant="outline">{dataSource}</Badge>
                {field && (
                  <>
                    {" "}
                    field <Badge variant="outline">{field}</Badge>
                  </>
                )}
                {filters.length > 0 && (
                  <>
                    {" "}
                    where{" "}
                    {filters.map((f, i) => (
                      <span key={i}>
                        {i > 0 && " AND "}
                        <Badge variant="secondary">
                          {f.field} {f.operator} {f.value}
                        </Badge>
                      </span>
                    ))}
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Metric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
