"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ListChecks,
  Plus,
  Loader2,
  Calendar,
  User,
  Sparkles,
  MessageSquareQuote,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ActionItem {
  id: string;
  description: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assigneeRole?: "CASE_MANAGER" | "CLIENT" | "OTHER" | null;
  dueDate: string | null;
  priority: number;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  source: "CALL_TRANSCRIPT" | "MANUAL";
  contextSnippet?: string | null;
  aiConfidence?: number | null;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface CallActionItemsProps {
  callId: string;
  actionItems: ActionItem[];
  onUpdate?: () => void;
  isLoading?: boolean;
  canExtract?: boolean;
  hasTranscript?: boolean;
}

const priorityConfig = {
  1: { label: "High", color: "bg-red-100 text-red-800 border-red-200" },
  2: { label: "Normal", color: "bg-blue-100 text-blue-800 border-blue-200" },
  3: { label: "Low", color: "bg-gray-100 text-gray-800 border-gray-200" },
};

const statusConfig = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
};

export function CallActionItems({
  callId,
  actionItems: initialItems,
  onUpdate,
  isLoading = false,
  canExtract = true,
  hasTranscript = false,
}: CallActionItemsProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialItems);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // New action item form state
  const [newItem, setNewItem] = useState({
    description: "",
    assigneeName: "",
    dueDate: "",
    priority: 2,
  });

  const extractActionItems = useCallback(async () => {
    setIsExtracting(true);
    try {
      const response = await fetch(`/api/calls/${callId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extract: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to extract action items");
      }

      const data = await response.json();
      toast.success(`Extracted ${data.data.extracted} action items`);

      // Refresh the list
      await refreshActionItems();
      onUpdate?.();
    } catch (error) {
      console.error("Error extracting action items:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to extract action items"
      );
    } finally {
      setIsExtracting(false);
    }
  }, [callId, onUpdate]);

  const refreshActionItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/calls/${callId}/action-items`);
      if (response.ok) {
        const data = await response.json();
        setActionItems(data.data);
      }
    } catch (error) {
      console.error("Error refreshing action items:", error);
    }
  }, [callId]);

  const createActionItem = useCallback(async () => {
    if (!newItem.description.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`/api/calls/${callId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newItem.description,
          assigneeName: newItem.assigneeName || undefined,
          dueDate: newItem.dueDate || undefined,
          priority: newItem.priority,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create action item");
      }

      toast.success("Action item created");
      setShowCreateDialog(false);
      setNewItem({ description: "", assigneeName: "", dueDate: "", priority: 2 });
      await refreshActionItems();
      onUpdate?.();
    } catch (error) {
      console.error("Error creating action item:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create action item"
      );
    } finally {
      setIsCreating(false);
    }
  }, [callId, newItem, onUpdate, refreshActionItems]);

  const toggleStatus = useCallback(
    async (item: ActionItem) => {
      const newStatus = item.status === "COMPLETED" ? "OPEN" : "COMPLETED";
      setUpdatingItemId(item.id);

      try {
        const response = await fetch(`/api/action-items/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          throw new Error("Failed to update action item");
        }

        setActionItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
        );
        onUpdate?.();
      } catch (error) {
        console.error("Error updating action item:", error);
        toast.error("Failed to update action item");
      } finally {
        setUpdatingItemId(null);
      }
    },
    [onUpdate]
  );

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const isOverdue = date < now;
    return { formatted: format(date, "MMM d"), isOverdue };
  };

  const aiExtractedItems = actionItems.filter((i) => i.source === "CALL_TRANSCRIPT");
  const manualItems = actionItems.filter((i) => i.source === "MANUAL");

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Action Items
            {actionItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {actionItems.filter((i) => i.status !== "COMPLETED").length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canExtract && hasTranscript && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={extractActionItems}
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Extract action items with AI</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : actionItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4">
            <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No action items yet</p>
            {hasTranscript && canExtract && (
              <Button
                variant="link"
                size="sm"
                onClick={extractActionItems}
                disabled={isExtracting}
                className="mt-2"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Extract from transcript
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {actionItems.map((item) => {
                const dueInfo = formatDueDate(item.dueDate);
                const isUpdating = updatingItemId === item.id;
                const priorityInfo = priorityConfig[item.priority as 1 | 2 | 3] || priorityConfig[2];

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "border rounded-lg p-3 space-y-2",
                      item.status === "COMPLETED" && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5">
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Checkbox
                            checked={item.status === "COMPLETED"}
                            onCheckedChange={() => toggleStatus(item)}
                            disabled={item.status === "CANCELLED"}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            item.status === "COMPLETED" && "line-through"
                          )}
                        >
                          {item.description}
                        </p>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", priorityInfo.color)}
                          >
                            {priorityInfo.label}
                          </Badge>

                          {item.source === "CALL_TRANSCRIPT" && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          )}

                          {item.assigneeName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.assigneeName}
                            </span>
                          )}

                          {dueInfo && (
                            <span
                              className={cn(
                                "text-xs flex items-center gap-1",
                                dueInfo.isOverdue && item.status !== "COMPLETED"
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground"
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {dueInfo.formatted}
                              {dueInfo.isOverdue && item.status !== "COMPLETED" && (
                                <AlertCircle className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>

                        {item.contextSnippet && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1 cursor-help">
                                  <MessageSquareQuote className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">
                                    "{item.contextSnippet}"
                                  </span>
                                </p>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <p>"{item.contextSnippet}"</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Create Action Item Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What needs to be done?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Input
                  id="assignee"
                  value={newItem.assigneeName}
                  onChange={(e) =>
                    setNewItem((prev) => ({ ...prev, assigneeName: e.target.value }))
                  }
                  placeholder="Who is responsible?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={String(newItem.priority)}
                  onValueChange={(value) =>
                    setNewItem((prev) => ({ ...prev, priority: Number(value) }))
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Normal</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={newItem.dueDate}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createActionItem} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
