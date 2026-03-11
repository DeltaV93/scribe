"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Search,
  User,
  Users,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface CaseManagerProfile {
  maxCaseload: number;
  currentCaseload: number;
  availabilityStatus: string;
  availabilityNote: string | null;
  languages: string[];
  skills: string[];
  specializations: string[];
  preferredClientTypes: string[];
  spotsAvailable: number;
}

interface CaseManager {
  id: string;
  name: string | null;
  email: string;
  role: string;
  profile: CaseManagerProfile;
}

interface AssignCaseManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  onAssigned?: (caseManagerId: string, caseManagerName: string) => void;
}

export function AssignCaseManagerDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentAssigneeId,
  currentAssigneeName,
  onAssigned,
}: AssignCaseManagerDialogProps) {
  const [caseManagers, setCaseManagers] = useState<CaseManager[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCaseManagers();
      setSelectedId(null);
      setSearch("");
    }
  }, [open]);

  const fetchCaseManagers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "/api/case-managers/availability?includeUnavailable=false&includeFull=false"
      );
      if (response.ok) {
        const data = await response.json();
        setCaseManagers(data.data.caseManagers);
      } else {
        toast.error("Failed to load case managers");
      }
    } catch (error) {
      console.error("Error fetching case managers:", error);
      toast.error("Failed to load case managers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) return;

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseManagerId: selectedId }),
      });

      if (response.ok) {
        const selectedCM = caseManagers.find((cm) => cm.id === selectedId);
        const name = selectedCM?.name || selectedCM?.email || "case manager";
        toast.success(`${clientName} assigned to ${name}`);
        onAssigned?.(selectedId, name);
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to assign client");
      }
    } catch (error) {
      console.error("Error assigning client:", error);
      toast.error("Failed to assign client");
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredCaseManagers = caseManagers.filter((cm) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      cm.name?.toLowerCase().includes(searchLower) ||
      cm.email.toLowerCase().includes(searchLower) ||
      cm.profile?.languages.some((l) => l.toLowerCase().includes(searchLower)) ||
      cm.profile?.skills.some((s) => s.toLowerCase().includes(searchLower))
    );
  });

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "LIMITED":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatStatus = (status: string) =>
    status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Case Manager
          </DialogTitle>
          <DialogDescription>
            Select a case manager to assign to {clientName}
            {currentAssigneeName && (
              <span className="block mt-1">
                Currently assigned to: <strong>{currentAssigneeName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, language, or skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Case manager list */}
          <ScrollArea className="h-[350px] rounded-md border p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredCaseManagers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No available case managers found</p>
                {search && (
                  <p className="text-sm">Try adjusting your search criteria</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCaseManagers.map((cm) => {
                  const isSelected = selectedId === cm.id;
                  const isCurrent = cm.id === currentAssigneeId;
                  const utilizationPercent = Math.round(
                    (cm.profile.currentCaseload / cm.profile.maxCaseload) * 100
                  );

                  return (
                    <div
                      key={cm.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isCurrent
                          ? "border-green-500 bg-green-50"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => !isCurrent && setSelectedId(cm.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div
                          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                            isSelected
                              ? "border-primary bg-primary"
                              : isCurrent
                              ? "border-green-500 bg-green-500"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {(isSelected || isCurrent) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {cm.name || cm.email}
                            </span>
                            {isCurrent && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                Current
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-xs ${getAvailabilityColor(cm.profile.availabilityStatus)}`}
                            >
                              {formatStatus(cm.profile.availabilityStatus)}
                            </Badge>
                          </div>

                          {cm.name && (
                            <p className="text-sm text-muted-foreground truncate mb-2">
                              {cm.email}
                            </p>
                          )}

                          {/* Caseload */}
                          <div className="flex items-center gap-2 mb-2">
                            <Progress value={utilizationPercent} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {cm.profile.currentCaseload}/{cm.profile.maxCaseload} (
                              {cm.profile.spotsAvailable} open)
                            </span>
                          </div>

                          {/* Languages and skills */}
                          <div className="flex flex-wrap gap-1">
                            {cm.profile.languages.slice(0, 3).map((lang) => (
                              <Badge key={lang} variant="secondary" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                            {cm.profile.skills.slice(0, 2).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(cm.profile.languages.length > 3 || cm.profile.skills.length > 2) && (
                              <Badge variant="outline" className="text-xs">
                                +{cm.profile.languages.length - 3 + cm.profile.skills.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Warning if changing assignment */}
          {selectedId && currentAssigneeId && selectedId !== currentAssigneeId && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Reassignment Notice</p>
                <p className="text-yellow-700">
                  This will reassign {clientName} from {currentAssigneeName} to a new case manager.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedId || selectedId === currentAssigneeId || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Case Manager"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
