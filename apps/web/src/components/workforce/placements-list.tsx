"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PlacementCard } from "./placement-card";
import { PlacementForm } from "./placement-form";
import { PlacementStatus } from "@prisma/client";
import { Plus, Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Placement {
  id: string;
  employerName: string;
  jobTitle: string;
  hourlyWage: string | number | null;
  startDate: string;
  endDate: string | null;
  status: PlacementStatus;
  notes: string | null;
}

interface PlacementsListProps {
  clientId: string;
  showAddButton?: boolean;
}

export function PlacementsList({ clientId, showAddButton = true }: PlacementsListProps) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPlacements = useCallback(async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/placements`);
      if (!response.ok) {
        throw new Error("Failed to fetch placements");
      }
      const data = await response.json();
      setPlacements(data.data || []);
    } catch (error) {
      console.error("Error fetching placements:", error);
      toast.error("Failed to load placements");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  const handleEdit = (id: string) => {
    const placement = placements.find((p) => p.id === id);
    if (placement) {
      setEditingPlacement(placement);
      setIsFormOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/placements/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete placement");
      }

      toast.success("Placement deleted");
      fetchPlacements();
    } catch (error) {
      console.error("Error deleting placement:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete placement");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleEndPlacement = async (id: string, status: "ENDED" | "TERMINATED") => {
    try {
      const response = await fetch(`/api/placements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, endDate: new Date().toISOString() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update placement");
      }

      toast.success(`Placement ${status === "ENDED" ? "ended" : "terminated"}`);
      fetchPlacements();
    } catch (error) {
      console.error("Error ending placement:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update placement");
    }
  };

  const handleFormSuccess = () => {
    setEditingPlacement(null);
    fetchPlacements();
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingPlacement(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showAddButton && (
        <div className="flex justify-end">
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Placement
          </Button>
        </div>
      )}

      {placements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No Job Placements</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Record job placements to track employment outcomes.
          </p>
          {showAddButton && (
            <Button className="mt-4" onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Placement
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {placements.map((placement) => (
            <PlacementCard
              key={placement.id}
              placement={placement}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
              onEndPlacement={handleEndPlacement}
            />
          ))}
        </div>
      )}

      <PlacementForm
        clientId={clientId}
        mode={editingPlacement ? "edit" : "create"}
        initialData={
          editingPlacement
            ? {
                ...editingPlacement,
                hourlyWage: editingPlacement.hourlyWage
                  ? parseFloat(String(editingPlacement.hourlyWage))
                  : null,
              }
            : undefined
        }
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Placement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this placement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
