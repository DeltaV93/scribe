"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface QuickEnrollDialogProps {
  programId: string;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: (enrollmentId: string, clientName: string) => void;
}

interface SearchResult {
  clientId: string;
  firstName: string;
  lastName: string;
  enrollmentId?: string;
}

export function QuickEnrollDialog({
  programId,
  sessionId,
  open,
  onOpenChange,
  onEnrolled,
}: QuickEnrollDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "" });

  const handleSearch = async () => {
    if (query.length < 2) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/attendance/quick-enroll?programId=${programId}&q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.data || []);
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnroll = async (clientId: string, clientName: string) => {
    setIsEnrolling(true);
    try {
      const response = await fetch(
        `/api/attendance/quick-enroll?programId=${programId}&action=enroll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        }
      );
      if (!response.ok) throw new Error("Enrollment failed");
      const data = await response.json();
      toast.success(`${clientName} enrolled`);
      onEnrolled(data.data.enrollmentId, clientName);
      onOpenChange(false);
      setQuery("");
      setResults([]);
    } catch {
      toast.error("Failed to enroll client");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleCreate = async () => {
    if (!newClient.firstName || !newClient.lastName) return;
    setIsEnrolling(true);
    try {
      const response = await fetch(
        `/api/attendance/quick-enroll?action=create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: newClient.firstName,
            lastName: newClient.lastName,
            programId,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to create client");
      const data = await response.json();
      const name = `${newClient.firstName} ${newClient.lastName}`;
      toast.success(`${name} created and enrolled`);
      onEnrolled(data.data.enrollmentId, name);
      onOpenChange(false);
      setNewClient({ firstName: "", lastName: "" });
      setShowCreate(false);
    } catch {
      toast.error("Failed to create client");
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Enroll Client</DialogTitle>
        </DialogHeader>

        {!showCreate ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search clients..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.clientId}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted"
                >
                  <span className="text-sm">
                    {r.firstName} {r.lastName}
                  </span>
                  {r.enrollmentId ? (
                    <span className="text-xs text-muted-foreground">
                      Already enrolled
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isEnrolling}
                      onClick={() =>
                        handleEnroll(r.clientId, `${r.firstName} ${r.lastName}`)
                      }
                    >
                      Enroll
                    </Button>
                  )}
                </div>
              ))}
              {results.length === 0 && query.length >= 2 && !isSearching && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No clients found
                </p>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create New Client
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={newClient.firstName}
                onChange={(e) =>
                  setNewClient({ ...newClient, firstName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={newClient.lastName}
                onChange={(e) =>
                  setNewClient({ ...newClient, lastName: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isEnrolling || !newClient.firstName || !newClient.lastName}
                className="flex-1"
              >
                {isEnrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & Enroll
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
