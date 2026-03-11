"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { RichProgressNotes } from "@/lib/services/call-goal-drafts";

interface RichCallContextCardProps {
  context: RichProgressNotes;
  timestamp: string;
}

const sentimentColors: Record<string, string> = {
  positive: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  concerned: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  distressed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function RichCallContextCard({ context, timestamp }: RichCallContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Header badges */}
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Phone className="h-3 w-3 mr-1" />
                Call
              </span>
              <span className="text-xs text-muted-foreground">
                {context.clientName}
              </span>
              {context.sentiment && (
                <Badge
                  variant="secondary"
                  className={cn("text-xs capitalize", sentimentColors[context.sentiment])}
                >
                  {context.sentiment}
                </Badge>
              )}
            </div>

            {/* Narrative */}
            <p className="text-sm">{context.narrative}</p>

            {/* Expandable details */}
            {context.expandable && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
                  {isExpanded ? "Hide" : "Show"} details
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {/* Action Items */}
                  {context.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                        Action Items
                      </h4>
                      <ul className="text-sm space-y-1">
                        {context.actionItems.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-muted-foreground">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Points */}
                  {context.keyPoints.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                        Key Points
                      </h4>
                      <ul className="text-sm space-y-1">
                        {context.keyPoints.map((point, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-muted-foreground">&bull;</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Topics */}
                  {context.topics.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                        Topics
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {context.topics.map((topic, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
