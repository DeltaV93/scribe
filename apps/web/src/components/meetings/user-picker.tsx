"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User, Search, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface UserPickerProps {
  /** Currently selected user ID */
  value?: string | null;
  /** Callback when user is selected */
  onSelect: (userId: string | null, user: OrgUser | null) => void;
  /** Current user ID (for "Assign to me" feature) */
  currentUserId?: string;
  /** Placeholder text when no user selected */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Additional class names for the trigger */
  className?: string;
}

export function UserPicker({
  value,
  onSelect,
  currentUserId,
  placeholder = "Select user...",
  disabled = false,
  trigger,
  className,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch users when dropdown opens
  useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async (searchQuery?: string) => {
    setIsLoading(true);
    try {
      const url = searchQuery
        ? `/api/users?search=${encodeURIComponent(searchQuery)}`
        : "/api/users";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      fetchUsers(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, open]);

  const selectedUser = users.find((u) => u.id === value);
  const currentUser = users.find((u) => u.id === currentUserId);

  const handleSelect = (user: OrgUser | null) => {
    onSelect(user?.id || null, user);
    setOpen(false);
    setSearch("");
  };

  const handleUnassign = () => {
    onSelect(null, null);
    setOpen(false);
    setSearch("");
  };

  // Filter users based on search (client-side filtering for already loaded users)
  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
            disabled={disabled}
          >
            {selectedUser ? (
              <span className="flex items-center gap-2">
                <Avatar name={selectedUser.name} id={selectedUser.id} size="sm" />
                <span className="truncate">{selectedUser.name || selectedUser.email}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8 px-0"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto p-1">
          {/* Unassign option */}
          {value && (
            <button
              type="button"
              onClick={handleUnassign}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <UserCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Unassign</span>
            </button>
          )}

          {/* Assign to me option */}
          {currentUserId && currentUserId !== value && currentUser && (
            <button
              type="button"
              onClick={() => handleSelect(currentUser)}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground border-b mb-1 pb-2"
            >
              <Avatar name={currentUser.name} id={currentUser.id} size="sm" className="mr-2" />
              <span className="font-medium">Assign to me</span>
            </button>
          )}

          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user)}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  value === user.id && "bg-accent"
                )}
              >
                <Avatar name={user.name} id={user.id} size="sm" className="mr-2" />
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="truncate">{user.name || "Unnamed"}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                </div>
                {value === user.id && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Simple "Assign to me" button component
 */
interface AssignToMeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function AssignToMeButton({
  onClick,
  disabled = false,
  className,
}: AssignToMeButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn("text-xs h-7 px-2", className)}
    >
      <User className="mr-1 h-3 w-3" />
      Assign to me
    </Button>
  );
}
