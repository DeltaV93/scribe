"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  Settings2,
  CreditCard,
  Users,
  Plug,
  Palette,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Delegation {
  id: string;
  userId: string;
  canManageBilling: boolean;
  canManageTeam: boolean;
  canManageIntegrations: boolean;
  canManageBranding: boolean;
  delegatedAt: string;
  expiresAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
  delegator: {
    id: string;
    name: string | null;
  };
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export function SettingsDelegationTab() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [delegatedUserIds, setDelegatedUserIds] = useState<Set<string>>(new Set());
  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add dialog state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [canManageBilling, setCanManageBilling] = useState(false);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [canManageIntegrations, setCanManageIntegrations] = useState(false);
  const [canManageBranding, setCanManageBranding] = useState(false);

  const fetchDelegations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings-delegation");
      if (response.ok) {
        const data = await response.json();
        setDelegations(data.data);
        const ids = new Set<string>(data.data.map((d: Delegation) => d.userId));
        setDelegatedUserIds(ids);
      }
    } catch (error) {
      console.error("Error fetching delegations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (search: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(search)}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out admin users since they already have full access
        const nonAdmins = data.data.filter(
          (u: User) => u.role !== "ADMIN" && u.role !== "SUPER_ADMIN"
        );
        setUsers(nonAdmins);
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
    fetchDelegations();
  }, [fetchDelegations]);

  // Reset add dialog state when closed
  useEffect(() => {
    if (!isAddDialogOpen) {
      setSearchQuery("");
      setUsers([]);
      setSelectedUserId(null);
      setCanManageBilling(false);
      setCanManageTeam(false);
      setCanManageIntegrations(false);
      setCanManageBranding(false);
    }
  }, [isAddDialogOpen]);

  // Reset edit dialog state when closed
  useEffect(() => {
    if (!isEditDialogOpen) {
      setEditingDelegation(null);
    }
  }, [isEditDialogOpen]);

  const handleAddDelegation = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/settings-delegation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          canManageBilling,
          canManageTeam,
          canManageIntegrations,
          canManageBranding,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create delegation");
      }

      toast.success("Settings delegation created");
      setIsAddDialogOpen(false);
      fetchDelegations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create delegation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDelegation = async () => {
    if (!editingDelegation) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/settings-delegation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingDelegation.userId,
          canManageBilling: editingDelegation.canManageBilling,
          canManageTeam: editingDelegation.canManageTeam,
          canManageIntegrations: editingDelegation.canManageIntegrations,
          canManageBranding: editingDelegation.canManageBranding,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update delegation");
      }

      toast.success("Settings delegation updated");
      setIsEditDialogOpen(false);
      fetchDelegations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update delegation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDelegation = async (delegationId: string) => {
    if (!confirm("Are you sure you want to remove this delegation?")) return;

    try {
      const response = await fetch(`/api/admin/settings-delegation/${delegationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove delegation");
      }

      toast.success("Delegation removed");
      fetchDelegations();
    } catch (error) {
      toast.error("Failed to remove delegation");
    }
  };

  const openEditDialog = (delegation: Delegation) => {
    setEditingDelegation({ ...delegation });
    setIsEditDialogOpen(true);
  };

  const getPermissionCount = (delegation: Delegation) => {
    let count = 0;
    if (delegation.canManageBilling) count++;
    if (delegation.canManageTeam) count++;
    if (delegation.canManageIntegrations) count++;
    if (delegation.canManageBranding) count++;
    return count;
  };

  const hasAnyPermission =
    canManageBilling || canManageTeam || canManageIntegrations || canManageBranding;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Settings Delegation</CardTitle>
          <CardDescription>
            Grant non-admin users access to specific settings areas
          </CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Delegate Access
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delegate Settings Access</DialogTitle>
              <DialogDescription>
                Select a user and choose which settings areas they can manage.
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
                      No non-admin users found
                    </div>
                  ) : (
                    users.map((user) => {
                      const hasDelegation = delegatedUserIds.has(user.id);
                      const isSelected = selectedUserId === user.id;

                      return (
                        <div
                          key={user.id}
                          onClick={() => !hasDelegation && setSelectedUserId(user.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted transition-colors",
                            hasDelegation && "opacity-50 cursor-not-allowed hover:bg-transparent",
                            isSelected && !hasDelegation && "bg-primary/10"
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
                          {hasDelegation && (
                            <Badge variant="secondary" className="text-xs">
                              Has Access
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

              {/* Permissions */}
              <div className="space-y-3">
                <Label>Settings Areas</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Billing</div>
                        <div className="text-xs text-muted-foreground">
                          Manage subscription and payment
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={canManageBilling}
                      onCheckedChange={setCanManageBilling}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Team</div>
                        <div className="text-xs text-muted-foreground">
                          Invite users and manage roles
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={canManageTeam}
                      onCheckedChange={setCanManageTeam}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Integrations</div>
                        <div className="text-xs text-muted-foreground">
                          Configure third-party connections
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={canManageIntegrations}
                      onCheckedChange={setCanManageIntegrations}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Branding</div>
                        <div className="text-xs text-muted-foreground">
                          Customize logo and colors
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={canManageBranding}
                      onCheckedChange={setCanManageBranding}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddDelegation}
                  disabled={!selectedUserId || !hasAnyPermission || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delegate Access
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
        ) : delegations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No delegations configured</p>
            <p className="text-sm">
              Delegate access to allow non-admin users to manage specific settings
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Delegated Areas</TableHead>
                <TableHead>Delegated By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delegations.map((delegation) => (
                <TableRow key={delegation.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={delegation.user.name}
                        id={delegation.user.id}
                        src={delegation.user.avatarUrl}
                        size="md"
                      />
                      <div>
                        <div className="font-medium">
                          {delegation.user.name || delegation.user.email}
                        </div>
                        {delegation.user.name && (
                          <div className="text-sm text-muted-foreground">
                            {delegation.user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {delegation.canManageBilling && (
                        <Badge variant="outline" className="text-xs">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Billing
                        </Badge>
                      )}
                      {delegation.canManageTeam && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Team
                        </Badge>
                      )}
                      {delegation.canManageIntegrations && (
                        <Badge variant="outline" className="text-xs">
                          <Plug className="h-3 w-3 mr-1" />
                          Integrations
                        </Badge>
                      )}
                      {delegation.canManageBranding && (
                        <Badge variant="outline" className="text-xs">
                          <Palette className="h-3 w-3 mr-1" />
                          Branding
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {delegation.delegator.name || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(delegation.delegatedAt), "MMM d, yyyy")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(delegation)}
                        title="Edit permissions"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDelegation(delegation.id)}
                        title="Remove delegation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit delegation dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Settings Delegation</DialogTitle>
              <DialogDescription>
                Update permissions for{" "}
                {editingDelegation?.user.name || editingDelegation?.user.email}
              </DialogDescription>
            </DialogHeader>
            {editingDelegation && (
              <div className="space-y-4">
                {/* Permissions */}
                <div className="space-y-3">
                  <Label>Settings Areas</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Billing</div>
                          <div className="text-xs text-muted-foreground">
                            Manage subscription and payment
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={editingDelegation.canManageBilling}
                        onCheckedChange={(checked) =>
                          setEditingDelegation({
                            ...editingDelegation,
                            canManageBilling: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Team</div>
                          <div className="text-xs text-muted-foreground">
                            Invite users and manage roles
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={editingDelegation.canManageTeam}
                        onCheckedChange={(checked) =>
                          setEditingDelegation({
                            ...editingDelegation,
                            canManageTeam: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plug className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Integrations</div>
                          <div className="text-xs text-muted-foreground">
                            Configure third-party connections
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={editingDelegation.canManageIntegrations}
                        onCheckedChange={(checked) =>
                          setEditingDelegation({
                            ...editingDelegation,
                            canManageIntegrations: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Branding</div>
                          <div className="text-xs text-muted-foreground">
                            Customize logo and colors
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={editingDelegation.canManageBranding}
                        onCheckedChange={(checked) =>
                          setEditingDelegation({
                            ...editingDelegation,
                            canManageBranding: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateDelegation}
                    disabled={getPermissionCount(editingDelegation) === 0 || isSubmitting}
                  >
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
