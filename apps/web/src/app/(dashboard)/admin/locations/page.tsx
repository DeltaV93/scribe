"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Loader2,
  MapPin,
  Plus,
  MoreHorizontal,
  Users,
  Building2,
  ChevronRight,
  Edit,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

type LocationType = "STORE" | "DISTRICT" | "REGION" | "HEADQUARTERS";
type AccessLevel = "VIEW" | "EDIT" | "MANAGE";

interface Location {
  id: string;
  name: string;
  type: LocationType;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  children: Array<{
    id: string;
    name: string;
    type: LocationType;
    code: string | null;
  }>;
  userCount: number;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  HEADQUARTERS: "Headquarters",
  REGION: "Region",
  DISTRICT: "District",
  STORE: "Store",
};

const LOCATION_TYPE_COLORS: Record<LocationType, string> = {
  HEADQUARTERS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  REGION: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  DISTRICT: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  STORE: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  VIEW: "View Only",
  EDIT: "Edit",
  MANAGE: "Manage",
};

export default function LocationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Create location dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "STORE" as LocationType,
    code: "",
    parentId: "",
  });

  // Edit location dialog
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirmation
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // User access dialog
  const [userAccessLocation, setUserAccessLocation] = useState<Location | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel>("VIEW");
  const [isAssigningAccess, setIsAssigningAccess] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.status === 403) {
        router.push("/dashboard?error=unauthorized");
        return;
      }
      if (response.ok) {
        await Promise.all([fetchLocations(), fetchUsers()]);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/admin/locations");
      if (response.ok) {
        const data = await response.json();
        setLocations(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast.error("Failed to load locations");
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users?format=full&includeInactive=false");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocation.name.trim(),
          type: newLocation.type,
          code: newLocation.code.trim() || undefined,
          parentId: newLocation.parentId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create location");
      }

      toast.success("Location created successfully");
      setIsCreateDialogOpen(false);
      setNewLocation({ name: "", type: "STORE", code: "", parentId: "" });
      await fetchLocations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create location");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation) return;

    setIsEditing(true);
    try {
      const response = await fetch(`/api/admin/locations/${editingLocation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingLocation.name,
          code: editingLocation.code || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update location");
      }

      toast.success("Location updated successfully");
      setEditingLocation(null);
      await fetchLocations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update location");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deletingLocationId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/locations/${deletingLocationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete location");
      }

      toast.success("Location deleted successfully");
      setDeletingLocationId(null);
      await fetchLocations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete location");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssignAccess = async () => {
    if (!userAccessLocation || !selectedUserId) return;

    setIsAssigningAccess(true);
    try {
      const response = await fetch(`/api/admin/locations/${userAccessLocation.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          accessLevel: selectedAccessLevel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign access");
      }

      toast.success("Access assigned successfully");
      setUserAccessLocation(null);
      setSelectedUserId("");
      setSelectedAccessLevel("VIEW");
      await fetchLocations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign access");
    } finally {
      setIsAssigningAccess(false);
    }
  };

  // Get parent locations for the dropdown (only locations of higher type)
  const getParentOptions = (type: LocationType): Location[] => {
    const typeOrder = ["STORE", "DISTRICT", "REGION", "HEADQUARTERS"];
    const currentIndex = typeOrder.indexOf(type);
    return locations.filter(
      (loc) => typeOrder.indexOf(loc.type) > currentIndex && loc.isActive
    );
  };

  // Organize locations by hierarchy
  const rootLocations = locations.filter((loc) => !loc.parentId && loc.isActive);
  const getChildren = (parentId: string) =>
    locations.filter((loc) => loc.parentId === parentId && loc.isActive);

  const renderLocationRow = (location: Location, depth = 0): React.ReactNode => {
    const children = getChildren(location.id);

    return (
      <React.Fragment key={location.id}>
        <TableRow>
          <TableCell>
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
              {depth > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{location.name}</span>
              {location.code && (
                <span className="text-muted-foreground">({location.code})</span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge className={LOCATION_TYPE_COLORS[location.type]}>
              {LOCATION_TYPE_LABELS[location.type]}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{location.userCount}</span>
            </div>
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setUserAccessLocation(location)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign User Access
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingLocation(location)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeletingLocationId(location.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {children.map((child) => renderLocationRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Location Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage your organization&apos;s location hierarchy and access control
            </p>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>
                Create a new location in your organization&apos;s hierarchy.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Downtown Store"
                  value={newLocation.name}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newLocation.type}
                  onValueChange={(value) =>
                    setNewLocation({
                      ...newLocation,
                      type: value as LocationType,
                      parentId: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STORE">Store</SelectItem>
                    <SelectItem value="DISTRICT">District</SelectItem>
                    <SelectItem value="REGION">Region</SelectItem>
                    <SelectItem value="HEADQUARTERS">Headquarters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (optional)</Label>
                <Input
                  id="code"
                  placeholder="e.g., DT001"
                  value={newLocation.code}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, code: e.target.value })
                  }
                />
              </div>
              {newLocation.type !== "HEADQUARTERS" && (
                <div className="space-y-2">
                  <Label htmlFor="parent">Parent Location (optional)</Label>
                  <Select
                    value={newLocation.parentId}
                    onValueChange={(value) =>
                      setNewLocation({ ...newLocation, parentId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {getParentOptions(newLocation.type).map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({LOCATION_TYPE_LABELS[loc.type]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateLocation} disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Location Hierarchy</CardTitle>
          <CardDescription>
            Locations are organized hierarchically. Access to a parent location grants
            access to all child locations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No locations yet</p>
              <p className="text-sm">Add your first location to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Users with Access</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rootLocations.map((location) => renderLocationRow(location))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Location Dialog */}
      <Dialog
        open={!!editingLocation}
        onOpenChange={() => setEditingLocation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update the location details.
            </DialogDescription>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingLocation.name}
                  onChange={(e) =>
                    setEditingLocation({
                      ...editingLocation,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Code</Label>
                <Input
                  id="edit-code"
                  value={editingLocation.code || ""}
                  onChange={(e) =>
                    setEditingLocation({
                      ...editingLocation,
                      code: e.target.value || null,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLocation(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateLocation} disabled={isEditing}>
              {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingLocationId}
        onOpenChange={() => setDeletingLocationId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this location? If the location has
              meetings, it will be deactivated instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign User Access Dialog */}
      <Dialog
        open={!!userAccessLocation}
        onOpenChange={() => setUserAccessLocation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User Access</DialogTitle>
            <DialogDescription>
              Grant a user access to {userAccessLocation?.name}. They will also
              have access to all child locations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-level">Access Level</Label>
              <Select
                value={selectedAccessLevel}
                onValueChange={(value) =>
                  setSelectedAccessLevel(value as AccessLevel)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEW">View Only - Can view meetings and data</SelectItem>
                  <SelectItem value="EDIT">Edit - Can view and edit meetings</SelectItem>
                  <SelectItem value="MANAGE">
                    Manage - Full control, can assign access to others
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserAccessLocation(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignAccess}
              disabled={isAssigningAccess || !selectedUserId}
            >
              {isAssigningAccess && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
