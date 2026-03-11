"use client";

import { useState } from "react";
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

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  onSuccess: () => void;
}

const ROLES = [
  { value: "VIEWER", label: "Viewer", description: "Read-only access (most restrictive)" },
  { value: "CASE_MANAGER", label: "Case Manager", description: "Can work with assigned clients and use forms" },
  { value: "FACILITATOR", label: "Facilitator", description: "Session facilitation and attendance" },
  { value: "PROGRAM_MANAGER", label: "Program Manager", description: "Can manage programs and forms" },
  { value: "ADMIN", label: "Administrator", description: "Full organization access" },
];

export function InviteUserDialog({
  open,
  onOpenChange,
  teams,
  onSuccess,
}: InviteUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [teamId, setTeamId] = useState<string>("");
  const [maxCaseload, setMaxCaseload] = useState<string>("");

  const resetForm = () => {
    setEmail("");
    setName("");
    setRole("VIEWER");
    setTeamId("");
    setMaxCaseload("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          role,
          teamId: teamId || undefined,
          maxCaseload: maxCaseload ? parseInt(maxCaseload) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      toast.success(`Invitation sent to ${email}`);
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new team member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email" required>
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="invite-name" required>
                Full Name
              </Label>
              <Input
                id="invite-name"
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
              <Label htmlFor="invite-role" required>
                Role
              </Label>
              <Select value={role} onValueChange={setRole} disabled={isSubmitting}>
                <SelectTrigger id="invite-role">
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
            </div>

            {/* Team (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="invite-team">Team (Optional)</Label>
              <Select
                value={teamId || "none"}
                onValueChange={(value) => setTeamId(value === "none" ? "" : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="invite-team">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({team.memberCount} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Caseload (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="invite-caseload">Max Caseload (Optional)</Label>
              <Input
                id="invite-caseload"
                type="number"
                min="1"
                placeholder="No limit"
                value={maxCaseload}
                onChange={(e) => setMaxCaseload(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of clients this user can be assigned
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
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
