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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface UserToEdit {
  id: string;
  name: string | null;
  email: string;
  role: string;
  maxCaseload: number | null;
  teamMemberships: { team: { id: string; name: string } }[];
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserToEdit | null;
  teams: Team[];
  onSuccess: () => void;
}

const ROLES = [
  { value: "CASE_MANAGER", label: "Case Manager", description: "Can work with clients and use forms" },
  { value: "PROGRAM_MANAGER", label: "Program Manager", description: "Can create and manage forms" },
  { value: "ADMIN", label: "Administrator", description: "Full organization access" },
  { value: "VIEWER", label: "Viewer", description: "Read-only access" },
];

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  teams,
  onSuccess,
}: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("CASE_MANAGER");
  const [teamId, setTeamId] = useState<string>("");
  const [maxCaseload, setMaxCaseload] = useState<string>("");

  // Populate form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setRole(user.role);
      setTeamId(user.teamMemberships[0]?.team.id || "");
      setMaxCaseload(user.maxCaseload?.toString() || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          teamId: teamId || null,
          maxCaseload: maxCaseload ? parseInt(maxCaseload) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      toast.success("User updated successfully");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update {user?.name || user?.email}&apos;s details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" required>
                Full Name
              </Label>
              <Input
                id="edit-name"
                type="text"
                placeholder="John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="edit-role" required>
                Role
              </Label>
              <Select value={role} onValueChange={setRole} disabled={isSubmitting}>
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <span className="font-medium">{r.label}</span>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {role !== user?.role && (
                <p className="text-xs text-amber-600">
                  Changing role will update this user&apos;s permissions
                </p>
              )}
            </div>

            {/* Team */}
            <div className="space-y-2">
              <Label htmlFor="edit-team">Team</Label>
              <Select value={teamId} onValueChange={setTeamId} disabled={isSubmitting}>
                <SelectTrigger id="edit-team">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({team.memberCount} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Caseload */}
            <div className="space-y-2">
              <Label htmlFor="edit-caseload">Max Caseload</Label>
              <Input
                id="edit-caseload"
                type="number"
                min="1"
                placeholder="No limit"
                value={maxCaseload}
                onChange={(e) => setMaxCaseload(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no limit
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
