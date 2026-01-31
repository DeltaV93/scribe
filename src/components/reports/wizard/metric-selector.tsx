"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, Sparkles, Check, Plus, Star } from "lucide-react";

export interface MetricSuggestion {
  metricId: string;
  relevanceScore: number;
  reason: string;
  priority: "required" | "recommended" | "optional";
}

export interface PreBuiltMetric {
  id: string;
  name: string;
  description: string;
  category: string;
  displayFormat: string;
  benchmark?: {
    good: number;
    excellent: number;
  };
}

interface MetricSelectorProps {
  availableMetrics: PreBuiltMetric[];
  selectedMetricIds: string[];
  onSelectionChange: (metricIds: string[]) => void;
  suggestions?: MetricSuggestion[];
  categories: Array<{ id: string; label: string; description: string }>;
}

const PRIORITY_CONFIG = {
  required: {
    label: "Required",
    color: "bg-red-100 text-red-800",
    icon: Star,
  },
  recommended: {
    label: "Recommended",
    color: "bg-blue-100 text-blue-800",
    icon: Check,
  },
  optional: {
    label: "Optional",
    color: "bg-gray-100 text-gray-800",
    icon: Plus,
  },
};

export function MetricSelector({
  availableMetrics,
  selectedMetricIds,
  onSelectionChange,
  suggestions = [],
  categories,
}: MetricSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Group metrics by category
  const metricsByCategory = new Map<string, PreBuiltMetric[]>();
  for (const metric of availableMetrics) {
    const existing = metricsByCategory.get(metric.category) || [];
    existing.push(metric);
    metricsByCategory.set(metric.category, existing);
  }

  // Filter metrics by search
  const filteredMetrics = availableMetrics.filter((metric) => {
    const matchesSearch =
      !searchQuery ||
      metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      metric.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !activeCategory || metric.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  // Get suggestion for a metric
  const getSuggestion = (metricId: string) => {
    return suggestions.find((s) => s.metricId === metricId);
  };

  // Toggle metric selection
  const toggleMetric = (metricId: string) => {
    if (selectedMetricIds.includes(metricId)) {
      onSelectionChange(selectedMetricIds.filter((id) => id !== metricId));
    } else {
      onSelectionChange([...selectedMetricIds, metricId]);
    }
  };

  // Select all suggested metrics of a priority
  const selectSuggestedByPriority = (priority: "required" | "recommended" | "optional") => {
    const toAdd = suggestions
      .filter((s) => s.priority === priority && !selectedMetricIds.includes(s.metricId))
      .map((s) => s.metricId);
    onSelectionChange([...selectedMetricIds, ...toAdd]);
  };

  // Render a metric card
  const renderMetricCard = (metric: PreBuiltMetric) => {
    const suggestion = getSuggestion(metric.id);
    const isSelected = selectedMetricIds.includes(metric.id);
    const priorityConfig = suggestion ? PRIORITY_CONFIG[suggestion.priority] : null;

    return (
      <Card
        key={metric.id}
        className={`cursor-pointer transition-all ${
          isSelected ? "border-primary ring-1 ring-primary/20" : ""
        }`}
        onClick={() => toggleMetric(metric.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleMetric(metric.id)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{metric.name}</span>
                {suggestion && priorityConfig && (
                  <Badge className={`${priorityConfig.color} text-xs`}>
                    {priorityConfig.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {metric.description}
              </p>
              {suggestion && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {suggestion.reason}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Suggestions</CardTitle>
            </div>
            <CardDescription>
              Based on your questionnaire answers, we recommend these metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestions.filter((s) => s.priority === "required").length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectSuggestedByPriority("required")}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Add All Required ({suggestions.filter((s) => s.priority === "required").length})
                </Button>
              )}
              {suggestions.filter((s) => s.priority === "recommended").length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectSuggestedByPriority("recommended")}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Add All Recommended ({suggestions.filter((s) => s.priority === "recommended").length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeCategory === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Selected Count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selectedMetricIds.length} metric{selectedMetricIds.length !== 1 ? "s" : ""} selected
        </span>
        {selectedMetricIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
          >
            Clear All
          </Button>
        )}
      </div>

      <Separator />

      {/* Metrics List */}
      <ScrollArea className="h-[400px]">
        {activeCategory === null ? (
          <Accordion type="multiple" defaultValue={categories.map((c) => c.id)}>
            {categories.map((category) => {
              const categoryMetrics = filteredMetrics.filter(
                (m) => m.category === category.id
              );
              if (categoryMetrics.length === 0) return null;

              return (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="text-sm font-medium">
                    {category.label} ({categoryMetrics.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {categoryMetrics.map(renderMetricCard)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMetrics.map(renderMetricCard)}
          </div>
        )}

        {filteredMetrics.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No metrics found matching your search
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
