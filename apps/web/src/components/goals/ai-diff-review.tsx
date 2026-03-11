"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestedDeliverable {
  name: string;
  description: string;
  metricType: string;
  targetValue: number;
  dueDate?: string;
  confidence: number;
}

interface AiDiffReviewProps {
  suggestions: SuggestedDeliverable[];
  onAccept: (accepted: SuggestedDeliverable[]) => void;
  onDismiss: () => void;
}

export function AiDiffReview({
  suggestions,
  onAccept,
  onDismiss,
}: AiDiffReviewProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(suggestions.map((_, i) => i))
  );

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleAccept = () => {
    const accepted = suggestions.filter((_, i) => selectedIndices.has(i));
    onAccept(accepted);
  };

  const selectAll = () => {
    setSelectedIndices(new Set(suggestions.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600 bg-green-100";
    if (confidence >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const formatMetricType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Review AI Suggestions
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Review the extracted deliverables. Uncheck any items you don&apos;t want to add.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <Card
                key={index}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedIndices.has(index)
                    ? "border-primary bg-primary/5"
                    : "opacity-60"
                )}
                onClick={() => toggleSelection(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIndices.has(index)}
                      onCheckedChange={() => toggleSelection(index)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{suggestion.name}</h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs shrink-0",
                            getConfidenceColor(suggestion.confidence)
                          )}
                        >
                          {suggestion.confidence}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">
                          {formatMetricType(suggestion.metricType)}
                        </Badge>
                        <Badge variant="secondary">
                          Target: {suggestion.targetValue}
                        </Badge>
                        {suggestion.dueDate && (
                          <Badge variant="secondary">
                            Due: {new Date(suggestion.dueDate).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {suggestions.some((s) => s.confidence < 60) && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Low confidence items</p>
              <p className="text-yellow-700">
                Some items have low confidence scores. Please review them carefully
                before accepting.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" onClick={onDismiss}>
            <X className="mr-2 h-4 w-4" />
            Dismiss All
          </Button>
          <Button
            onClick={handleAccept}
            disabled={selectedIndices.size === 0}
          >
            <Check className="mr-2 h-4 w-4" />
            Add {selectedIndices.size} Item{selectedIndices.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
