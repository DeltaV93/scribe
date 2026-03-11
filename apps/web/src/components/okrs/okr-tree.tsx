"use client";

import { useState } from "react";
import { ObjectiveCard } from "./objective-card";
import { ObjectiveStatus } from "@prisma/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObjectiveTreeNode {
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
  children: ObjectiveTreeNode[];
}

interface OKRTreeProps {
  objectives: ObjectiveTreeNode[];
  onObjectiveClick: (objectiveId: string) => void;
  className?: string;
}

interface TreeNodeProps {
  objective: ObjectiveTreeNode;
  depth: number;
  onObjectiveClick: (objectiveId: string) => void;
}

function TreeNode({ objective, depth, onObjectiveClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Expand first 2 levels by default
  const hasChildren = objective.children.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-6 p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        <div className="flex-1">
          <ObjectiveCard
            objective={objective}
            onClick={() => onObjectiveClick(objective.id)}
          />
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div
          className={cn(
            "ml-8 pl-4 border-l-2 border-muted space-y-2",
            depth >= 2 && "ml-6"
          )}
        >
          {objective.children.map((child) => (
            <TreeNode
              key={child.id}
              objective={child}
              depth={depth + 1}
              onObjectiveClick={onObjectiveClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OKRTree({ objectives, onObjectiveClick, className }: OKRTreeProps) {
  if (objectives.length === 0) {
    return (
      <div className={cn("text-center py-12 text-muted-foreground", className)}>
        No objectives found
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {objectives.map((objective) => (
        <TreeNode
          key={objective.id}
          objective={objective}
          depth={0}
          onObjectiveClick={onObjectiveClick}
        />
      ))}
    </div>
  );
}
