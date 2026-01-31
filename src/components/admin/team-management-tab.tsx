"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  UserPlus,
  MoreHorizontal,
  Pencil,
  UserMinus,
  UserCheck,
  ArrowLeftRight,
  Trash2,
  Users,
  UserX,
  Search,
  X,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { InviteUserDialog } from "./invite-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import { PendingInvitations } from "./pending-invitations";
import {
  DeactivateUserDialog,
  ReactivateUserDialog,
  TransferDataDialog,
  DeleteUserDialog,
} from "./user-actions-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";

// Types
interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  maxCaseload: number | null;
  lastLoginAt: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  teamMemberships: { team: { id: string; name: string } }[];
  _count: {
    assignedClients: number;
    calls: number;
    formSubmissions: number;
  };
}

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  reminderSentAt: string | null;
  isExpired: boolean;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface UserLimits {
  canInvite: boolean;
  currentCount: number;
  limit: number;
  tier: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  PROGRAM_MANAGER: "Program Manager",
  CASE_MANAGER: "Case Manager",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  PROGRAM_MANAGER: "bg-green-100 text-green-800",
  CASE_MANAGER: "bg-amber-100 text-amber-800",
  VIEWER: "bg-gray-100 text-gray-800",
};

export function TeamManagementTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [limits, setLimits] = useState<UserLimits | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<User | null>(null);
  const [transferTarget, setTransferTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchUsers = useCallback(async (search?: string, role?: string, team?: string) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ includeInactive: "true" });
      if (search) params.set("search", search);
      if (role && role !== "all") params.set("role", role);
      if (team && team !== "all") params.set("team", team);

      const usersRes = await fetch(`/api/admin/users?${params.toString()}`);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, invitationsRes, teamsRes, limitsRes] = await Promise.all([
        fetch("/api/admin/users?includeInactive=true"),
        fetch("/api/admin/users/invitations"),
        fetch("/api/admin/teams"),
        fetch("/api/admin/users/limits"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data);
      }

      if (invitationsRes.ok) {
        const data = await invitationsRes.json();
        setInvitations(data.data);
      }

      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data.data || []);
      }

      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setLimits(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchUsers(searchQuery, roleFilter, teamFilter);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, roleFilter, teamFilter, fetchUsers]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setTeamFilter("all");
  };

  const hasActiveFilters = searchQuery || roleFilter !== "all" || teamFilter !== "all";

  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);
  const pendingInvitationCount = invitations.filter(
    (i) => i.status === "PENDING"
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          {limits && (
            <p className="text-sm text-muted-foreground">
              {limits.currentCount} of {limits.limit} users ({limits.tier} plan)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setBulkImportDialogOpen(true)}
            disabled={limits ? !limits.canInvite : false}
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)} disabled={limits ? !limits.canInvite : false}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Role: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Role: All</SelectItem>
            <SelectItem value="ADMIN">Administrator</SelectItem>
            <SelectItem value="PROGRAM_MANAGER">Program Manager</SelectItem>
            <SelectItem value="CASE_MANAGER">Case Manager</SelectItem>
            <SelectItem value="VIEWER">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Team: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Team: All</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Pending Invitations */}
      <PendingInvitations invitations={invitations} onRefresh={fetchInitialData} />

      {/* User Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Users className="h-4 w-4" />
            Active ({activeUsers.length})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-2">
            <UserX className="h-4 w-4" />
            Inactive ({inactiveUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
              <CardDescription>
                Users who can currently access the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeUsers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? "No users found matching your filters" : "No active users"}
                </p>
              ) : (
                <UserTable
                  users={activeUsers}
                  onEdit={setEditTarget}
                  onDeactivate={setDeactivateTarget}
                  onTransfer={setTransferTarget}
                  showDeactivate
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive">
          <Card>
            <CardHeader>
              <CardTitle>Inactive Users</CardTitle>
              <CardDescription>
                Deactivated users who cannot access the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveUsers.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? "No users found matching your filters" : "No inactive users"}
                </p>
              ) : (
                <UserTable
                  users={inactiveUsers}
                  onEdit={setEditTarget}
                  onReactivate={setReactivateTarget}
                  onTransfer={setTransferTarget}
                  onDelete={setDeleteTarget}
                  showReactivate
                  showDelete
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        teams={teams}
        onSuccess={fetchInitialData}
      />

      <BulkImportDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
        teams={teams}
        onSuccess={fetchInitialData}
      />

      <EditUserDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        user={editTarget}
        teams={teams}
        onSuccess={fetchInitialData}
      />

      {deactivateTarget && (
        <DeactivateUserDialog
          open={!!deactivateTarget}
          onOpenChange={(open) => !open && setDeactivateTarget(null)}
          userId={deactivateTarget.id}
          userName={deactivateTarget.name || deactivateTarget.email}
          onSuccess={fetchInitialData}
        />
      )}

      {reactivateTarget && (
        <ReactivateUserDialog
          open={!!reactivateTarget}
          onOpenChange={(open) => !open && setReactivateTarget(null)}
          userId={reactivateTarget.id}
          userName={reactivateTarget.name || reactivateTarget.email}
          onSuccess={fetchInitialData}
        />
      )}

      {transferTarget && (
        <TransferDataDialog
          open={!!transferTarget}
          onOpenChange={(open) => !open && setTransferTarget(null)}
          fromUserId={transferTarget.id}
          fromUserName={transferTarget.name || transferTarget.email}
          availableUsers={activeUsers
            .filter((u) => u.id !== transferTarget.id)
            .map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
            }))}
          onSuccess={fetchInitialData}
        />
      )}

      {deleteTarget && (
        <DeleteUserDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          userId={deleteTarget.id}
          userName={deleteTarget.name || deleteTarget.email}
          userEmail={deleteTarget.email}
          onSuccess={fetchInitialData}
        />
      )}
    </div>
  );
}

// User Table Component
interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDeactivate?: (user: User) => void;
  onReactivate?: (user: User) => void;
  onTransfer?: (user: User) => void;
  onDelete?: (user: User) => void;
  showDeactivate?: boolean;
  showReactivate?: boolean;
  showDelete?: boolean;
}

function UserTable({
  users,
  onEdit,
  onDeactivate,
  onReactivate,
  onTransfer,
  onDelete,
  showDeactivate,
  showReactivate,
  showDelete,
}: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Caseload</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div>
                <p className="font-medium">{user.name || "Unnamed"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge className={ROLE_COLORS[user.role] || "bg-gray-100"}>
                {ROLE_LABELS[user.role] || user.role}
              </Badge>
            </TableCell>
            <TableCell>
              {user.teamMemberships.length > 0 ? (
                <span className="text-sm">
                  {user.teamMemberships.map((tm) => tm.team.name).join(", ")}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No team</span>
              )}
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <span className="font-medium">{user._count.assignedClients}</span>
                {user.maxCaseload && (
                  <span className="text-muted-foreground">
                    {" "}
                    / {user.maxCaseload}
                  </span>
                )}
                <span className="text-muted-foreground"> clients</span>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {user.lastLoginAt
                  ? formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(user)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {onTransfer && (
                    <DropdownMenuItem onClick={() => onTransfer(user)}>
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      Transfer Data
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {showDeactivate && onDeactivate && (
                    <DropdownMenuItem
                      onClick={() => onDeactivate(user)}
                      className="text-amber-600 focus:text-amber-600"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  )}
                  {showReactivate && onReactivate && (
                    <DropdownMenuItem onClick={() => onReactivate(user)}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Reactivate
                    </DropdownMenuItem>
                  )}
                  {showDelete && onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(user)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Permanently
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
