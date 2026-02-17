"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { ProgramMemberRole } from "@prisma/client";
import { Plus, Search, Loader2, UserMinus, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProgramMember {
  id: string;
  programId: string;
  userId: string;
  role: ProgramMemberRole;
  canEditEnrollments: boolean;
  canEditAttendance: boolean;
  canViewAllClients: boolean;
  notes: string | null;
  assignedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
  assigner?: {
    id: string;
    name: string | null;
  } | null;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ProgramMembersTabProps {
  programId: string;
}

export function ProgramMembersTab({ programId }: ProgramMembersTabProps) {
  const [members, setMembers] = useState<ProgramMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set());
  const [editingMember, setEditingMember] = useState<ProgramMember | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add dialog state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProgramMemberRole>(ProgramMemberRole.CASE_MANAGER);
  const [canEditEnrollments, setCanEditEnrollments] = useState(false);
  const [canEditAttendance, setCanEditAttendance] = useState(true);
  const [canViewAllClients, setCanViewAllClients] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.data);
        const ids = new Set<string>(data.data.map((m: ProgramMember) => m.userId));
        setMemberUserIds(ids);
      }
    } catch (error) {
      console.error("Error fetching program members:", error);
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  const fetchUsers = useCallback(async (search: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(search)}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchUsers(searchQuery);
      }, 300);
    } else {
      setUsers([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchUsers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Reset add dialog state when closed
  useEffect(() => {
    if (!isAddDialogOpen) {
      setSearchQuery("");
      setUsers([]);
      setSelectedUserId(null);
      setSelectedRole(ProgramMemberRole.CASE_MANAGER);
      setCanEditEnrollments(false);
      setCanEditAttendance(true);
      setCanViewAllClients(false);
    }
  }, [isAddDialogOpen]);

  // Reset edit dialog state when closed
  useEffect(() => {
    if (!isEditDialogOpen) {
      setEditingMember(null);
    }
  }, [isEditDialogOpen]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/programs/${programId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
          canEditEnrollments,
          canEditAttendance,
          canViewAllClients,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to add member");
      }

      toast.success("Member added to program");
      setIsAddDialogOpen(false);
      fetchMembers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/programs/${programId}/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editingMember.role,
          canEditEnrollments: editingMember.canEditEnrollments,
          canEditAttendance: editingMember.canEditAttendance,
          canViewAllClients: editingMember.canViewAllClients,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update member");
      }

      toast.success("Member permissions updated");
      setIsEditDialogOpen(false);
      fetchMembers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the program?")) return;

    try {
      const response = await fetch(`/api/programs/${programId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      toast.success("Member removed from program");
      fetchMembers();
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const getRoleLabel = (role: ProgramMemberRole) => {
    const labels: Record<ProgramMemberRole, string> = {
      MANAGER: "Manager",
      FACILITATOR: "Facilitator",
      CASE_MANAGER: "Case Manager",
      VIEWER: "Viewer",
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: ProgramMemberRole) => {
    const colors: Record<ProgramMemberRole, string> = {
      MANAGER: "bg-purple-100 text-purple-800",
      FACILITATOR: "bg-blue-100 text-blue-800",
      CASE_MANAGER: "bg-green-100 text-green-800",
      VIEWER: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const openEditDialog = (member: ProgramMember) => {
    setEditingMember({ ...member });
    setIsEditDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Members</CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a user to this program and set their permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* User search */}
              <div className="space-y-2">
                <Label>Search User</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {users.length === 0 && !isSearching ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    users.map((user) => {
                      const isMember = memberUserIds.has(user.id);
                      const isSelected = selectedUserId === user.id;

                      return (
                        <div
                          key={user.id}
                          onClick={() => !isMember && setSelectedUserId(user.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted transition-colors",
                            isMember && "opacity-50 cursor-not-allowed hover:bg-transparent",
                            isSelected && !isMember && "bg-primary/10"
                          )}
                        >
                          <Avatar
                            name={user.name}
                            id={user.id}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {user.name || user.email}
                            </div>
                            {user.name && (
                              <div className="text-sm text-muted-foreground truncate">
                                {user.email}
                              </div>
                            )}
                          </div>
                          {isMember && (
                            <Badge variant="secondary" className="text-xs">
                              Member
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Selected user display */}
              {selectedUserId && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-sm font-medium">
                    Selected: {users.find((u) => u.id === selectedUserId)?.name ||
                      users.find((u) => u.id === selectedUserId)?.email}
                  </div>
                </div>
              )}

              {/* Role selection */}
              <div className="space-y-2">
                <Label>Program Role</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as ProgramMemberRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ProgramMemberRole.MANAGER}>
                      Manager - Full program management
                    </SelectItem>
                    <SelectItem value={ProgramMemberRole.FACILITATOR}>
                      Facilitator - Session facilitation
                    </SelectItem>
                    <SelectItem value={ProgramMemberRole.CASE_MANAGER}>
                      Case Manager - Client-focused work
                    </SelectItem>
                    <SelectItem value={ProgramMemberRole.VIEWER}>
                      Viewer - Read-only access
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permissions */}
              <div className="space-y-3">
                <Label>Permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Edit Enrollments</div>
                      <div className="text-xs text-muted-foreground">
                        Enroll and withdraw clients
                      </div>
                    </div>
                    <Switch
                      checked={canEditEnrollments}
                      onCheckedChange={setCanEditEnrollments}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Edit Attendance</div>
                      <div className="text-xs text-muted-foreground">
                        Mark attendance for sessions
                      </div>
                    </div>
                    <Switch
                      checked={canEditAttendance}
                      onCheckedChange={setCanEditAttendance}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">View All Clients</div>
                      <div className="text-xs text-muted-foreground">
                        See all enrolled clients, not just assigned
                      </div>
                    </div>
                    <Switch
                      checked={canViewAllClients}
                      onCheckedChange={setCanViewAllClients}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={!selectedUserId || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Member
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No team members assigned</p>
            <p className="text-sm">Add team members to grant them access to this program</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Program Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.user.name}
                        id={member.user.id}
                        src={member.user.avatarUrl}
                        size="md"
                      />
                      <div>
                        <div className="font-medium">
                          {member.user.name || member.user.email}
                        </div>
                        {member.user.name && (
                          <div className="text-sm text-muted-foreground">
                            {member.user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleColor(member.role)}>
                      {getRoleLabel(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.canEditEnrollments && (
                        <Badge variant="outline" className="text-xs">
                          Enrollments
                        </Badge>
                      )}
                      {member.canEditAttendance && (
                        <Badge variant="outline" className="text-xs">
                          Attendance
                        </Badge>
                      )}
                      {member.canViewAllClients && (
                        <Badge variant="outline" className="text-xs">
                          All Clients
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(member.assignedAt), "MMM d, yyyy")}
                    </div>
                    {member.assigner && (
                      <div className="text-xs text-muted-foreground">
                        by {member.assigner.name || "Unknown"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(member)}
                        title="Edit permissions"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                        title="Remove from program"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit member dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Member Permissions</DialogTitle>
              <DialogDescription>
                Update role and permissions for{" "}
                {editingMember?.user.name || editingMember?.user.email}
              </DialogDescription>
            </DialogHeader>
            {editingMember && (
              <div className="space-y-4">
                {/* Role selection */}
                <div className="space-y-2">
                  <Label>Program Role</Label>
                  <Select
                    value={editingMember.role}
                    onValueChange={(value) =>
                      setEditingMember({ ...editingMember, role: value as ProgramMemberRole })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ProgramMemberRole.MANAGER}>
                        Manager - Full program management
                      </SelectItem>
                      <SelectItem value={ProgramMemberRole.FACILITATOR}>
                        Facilitator - Session facilitation
                      </SelectItem>
                      <SelectItem value={ProgramMemberRole.CASE_MANAGER}>
                        Case Manager - Client-focused work
                      </SelectItem>
                      <SelectItem value={ProgramMemberRole.VIEWER}>
                        Viewer - Read-only access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Permissions */}
                <div className="space-y-3">
                  <Label>Permissions</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Edit Enrollments</div>
                        <div className="text-xs text-muted-foreground">
                          Enroll and withdraw clients
                        </div>
                      </div>
                      <Switch
                        checked={editingMember.canEditEnrollments}
                        onCheckedChange={(checked) =>
                          setEditingMember({ ...editingMember, canEditEnrollments: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Edit Attendance</div>
                        <div className="text-xs text-muted-foreground">
                          Mark attendance for sessions
                        </div>
                      </div>
                      <Switch
                        checked={editingMember.canEditAttendance}
                        onCheckedChange={(checked) =>
                          setEditingMember({ ...editingMember, canEditAttendance: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">View All Clients</div>
                        <div className="text-xs text-muted-foreground">
                          See all enrolled clients, not just assigned
                        </div>
                      </div>
                      <Switch
                        checked={editingMember.canViewAllClients}
                        onCheckedChange={(checked) =>
                          setEditingMember({ ...editingMember, canViewAllClients: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateMember} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
