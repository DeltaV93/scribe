"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CredentialCard } from "./credential-card";
import { CredentialForm } from "./credential-form";
import { CredentialStatus } from "@prisma/client";
import { Plus, Loader2, Award } from "lucide-react";
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

interface Credential {
  id: string;
  name: string;
  issuingOrg: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: CredentialStatus;
  documentUrl: string | null;
  notes: string | null;
  daysUntilExpiry: number | null;
}

interface CredentialsListProps {
  clientId: string;
  showAddButton?: boolean;
}

export function CredentialsList({ clientId, showAddButton = true }: CredentialsListProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "renew">("create");
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCredentials = useCallback(async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/credentials`);
      if (!response.ok) {
        throw new Error("Failed to fetch credentials");
      }
      const data = await response.json();
      setCredentials(data.data || []);
    } catch (error) {
      console.error("Error fetching credentials:", error);
      toast.error("Failed to load credentials");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleEdit = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (credential) {
      setEditingCredential(credential);
      setFormMode("edit");
      setIsFormOpen(true);
    }
  };

  const handleRenew = (id: string) => {
    const credential = credentials.find((c) => c.id === id);
    if (credential) {
      setEditingCredential(credential);
      setFormMode("renew");
      setIsFormOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/credentials/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete credential");
      }

      toast.success("Credential deleted");
      fetchCredentials();
    } catch (error) {
      console.error("Error deleting credential:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete credential");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleFormSuccess = () => {
    setEditingCredential(null);
    setFormMode("create");
    fetchCredentials();
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingCredential(null);
      setFormMode("create");
    }
  };

  const handleAddNew = () => {
    setEditingCredential(null);
    setFormMode("create");
    setIsFormOpen(true);
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
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Credential
          </Button>
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Award className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No Credentials</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track certifications and credentials to monitor expiration dates.
          </p>
          {showAddButton && (
            <Button className="mt-4" onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Credential
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {credentials.map((credential) => (
            <CredentialCard
              key={credential.id}
              credential={credential}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
              onRenew={handleRenew}
            />
          ))}
        </div>
      )}

      <CredentialForm
        clientId={clientId}
        mode={formMode}
        initialData={
          editingCredential
            ? {
                id: editingCredential.id,
                name: editingCredential.name,
                issuingOrg: editingCredential.issuingOrg,
                issueDate: editingCredential.issueDate,
                expiryDate: editingCredential.expiryDate,
                documentUrl: editingCredential.documentUrl,
                notes: editingCredential.notes,
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
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this credential? This action cannot be undone.
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
