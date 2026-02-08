"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Loader2, Search, Users, Calendar, Shield } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ClientShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentAssignedUserId: string;
  onShareCreated?: () => void;
}

type PermissionLevel = "VIEW" | "EDIT" | "FULL";

const PERMISSION_DESCRIPTIONS: Record<PermissionLevel, string> = {
  VIEW: "Can view client profile and history",
  EDIT: "Can view and edit client information",
  FULL: "Full access to client data, calls, and notes",
};

const EXPIRATION_OPTIONS = [
  { label: "No expiration", value: "never" },
  { label: "1 week", value: "1w" },
  { label: "2 weeks", value: "2w" },
  { label: "1 month", value: "1m" },
  { label: "3 months", value: "3m" },
  { label: "Custom date", value: "custom" },
];

export function ClientShareDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentAssignedUserId,
  onShareCreated,
}: ClientShareDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permission, setPermission] = useState<PermissionLevel>("VIEW");
  const [expirationOption, setExpirationOption] = useState("never");
  const [customExpirationDate, setCustomExpirationDate] = useState("");
  const [notes, setNotes] = useState("");

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      user.name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower);
    // Exclude current assigned user
    return matchesSearch && user.id !== currentAssignedUserId;
  });

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedUserId("");
      setPermission("VIEW");
      setExpirationOption("never");
      setCustomExpirationDate("");
      setNotes("");
      setSearchQuery("");
    }
  }, [open]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const calculateExpirationDate = (): string | null => {
    const now = new Date();

    switch (expirationOption) {
      case "never":
        return null;
      case "1w":
        return addWeeks(now, 1).toISOString();
      case "2w":
        return addWeeks(now, 2).toISOString();
      case "1m":
        return addMonths(now, 1).toISOString();
      case "3m":
        return addMonths(now, 3).toISOString();
      case "custom":
        return customExpirationDate
          ? new Date(customExpirationDate).toISOString()
          : null;
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to share with");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedWithUserId: selectedUserId,
          permission,
          expiresAt: calculateExpirationDate(),
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to share client");
      }

      toast.success("Client shared successfully");
      onOpenChange(false);
      onShareCreated?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to share client"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Client
          </DialogTitle>
          <DialogDescription>
            Share access to <span className="font-medium">{clientName}</span>{" "}
            with another team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user-search">Select Team Member</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="user-search"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {searchQuery
                      ? "No matching users found"
                      : "No users available to share with"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={`w-full p-3 text-left hover:bg-accent transition-colors ${
                          selectedUserId === user.id
                            ? "bg-accent border-l-2 border-l-primary"
                            : ""
                        }`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="font-medium">
                          {user.name || "Unnamed User"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Permission Level */}
          <div className="space-y-2">
            <Label htmlFor="permission" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Permission Level
            </Label>
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value as PermissionLevel)}
            >
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW">View Only</SelectItem>
                <SelectItem value="EDIT">Edit</SelectItem>
                <SelectItem value="FULL">Full Access</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {PERMISSION_DESCRIPTIONS[permission]}
            </p>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expiration" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Access Duration
            </Label>
            <Select value={expirationOption} onValueChange={setExpirationOption}>
              <SelectTrigger id="expiration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {expirationOption === "custom" && (
              <Input
                type="date"
                value={customExpirationDate}
                onChange={(e) => setCustomExpirationDate(e.target.value)}
                min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Reason for sharing (e.g., coverage during leave, collaboration on case)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedUserId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Share Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
