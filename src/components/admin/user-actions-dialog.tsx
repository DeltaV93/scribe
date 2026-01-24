"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ============================================
// Deactivate User Dialog
// ============================================

interface DeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onSuccess: () => void;
}

export function DeactivateUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: DeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDeactivate = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate user");
      }

      toast.success(`${userName} has been deactivated`);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deactivate <strong>{userName}</strong>?
            <br /><br />
            They will no longer be able to log in, but their data will be preserved.
            You can reactivate them later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              "Deactivate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// Reactivate User Dialog
// ============================================

interface ReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onSuccess: () => void;
}

export function ReactivateUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: ReactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReactivate = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}/reactivate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reactivate user");
      }

      toast.success(`${userName} has been reactivated`);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to reactivate <strong>{userName}</strong>?
            <br /><br />
            They will be able to log in again with their existing credentials.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReactivate} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivating...
              </>
            ) : (
              "Reactivate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// Transfer Data Dialog
// ============================================

interface TransferUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromUserId: string;
  fromUserName: string;
  availableUsers: TransferUser[];
  onSuccess: () => void;
}

export function TransferDataDialog({
  open,
  onOpenChange,
  fromUserId,
  fromUserName,
  availableUsers,
  onSuccess,
}: TransferDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toUserId, setToUserId] = useState<string>("");
  const [transferClients, setTransferClients] = useState(true);
  const [transferSubmissions, setTransferSubmissions] = useState(true);

  const handleTransfer = async () => {
    if (!toUserId) {
      toast.error("Please select a user to transfer to");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${fromUserId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId,
          transferClients,
          transferSubmissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transfer data");
      }

      const { clients, submissions } = data.transferred;
      toast.success(
        `Transferred ${clients} client(s) and ${submissions} submission(s)`
      );
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer data");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer User Data</AlertDialogTitle>
          <AlertDialogDescription>
            Transfer <strong>{fromUserName}</strong>&apos;s assigned data to another user.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Target User */}
          <div className="space-y-2">
            <Label htmlFor="transfer-to">Transfer to</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger id="transfer-to">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* What to transfer */}
          <div className="space-y-3">
            <Label>Data to transfer</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="transfer-clients"
                checked={transferClients}
                onCheckedChange={(checked) => setTransferClients(checked as boolean)}
              />
              <label
                htmlFor="transfer-clients"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Assigned clients
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="transfer-submissions"
                checked={transferSubmissions}
                onCheckedChange={(checked) => setTransferSubmissions(checked as boolean)}
              />
              <label
                htmlFor="transfer-submissions"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Form submissions
              </label>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleTransfer}
            disabled={isSubmitting || !toUserId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer Data"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================
// Delete User Dialog
// ============================================

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
  onSuccess,
}: DeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    if (confirmText !== userEmail) {
      toast.error("Please type the user's email to confirm");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success(`${userName} has been permanently deleted`);
      setConfirmText("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Delete User Permanently
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action <strong>cannot be undone</strong>. This will permanently
            delete <strong>{userName}</strong>&apos;s account.
            <br /><br />
            Before deleting, ensure all their data has been transferred to another user.
            <br /><br />
            Type <strong>{userEmail}</strong> to confirm:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Input
            placeholder={userEmail}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting} onClick={() => setConfirmText("")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isSubmitting || confirmText !== userEmail}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Permanently"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
