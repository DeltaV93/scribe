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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { EnrollmentStatus } from "@prisma/client";
import { Plus, Search, Loader2, UserMinus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Enrollment {
  id: string;
  clientId: string;
  enrolledDate: string;
  status: EnrollmentStatus;
  hoursCompleted: number;
  hoursOverride: number | null;
  effectiveHours: number;
  completionDate: string | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  program?: {
    requiredHours: number | null;
  };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  lastActivityAt: string | null;
}

interface EnrollmentsTabProps {
  programId: string;
}

export function EnrollmentsTab({ programId }: EnrollmentsTabProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [enrolledClientIds, setEnrolledClientIds] = useState<Set<string>>(new Set());
  const [requiredHours, setRequiredHours] = useState<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/enrollments`);
      if (response.ok) {
        const data = await response.json();
        setEnrollments(data.data);
        // Extract enrolled client IDs
        const ids = new Set<string>(data.data.map((e: Enrollment) => e.clientId));
        setEnrolledClientIds(ids);
        if (data.data[0]?.program?.requiredHours) {
          setRequiredHours(data.data[0].program.requiredHours);
        }
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  const fetchClients = useCallback(async (search: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(search)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
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
        fetchClients(searchQuery);
      }, 300);
    } else {
      setClients([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchClients]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Reset dialog state when closed
  useEffect(() => {
    if (!isDialogOpen) {
      setSearchQuery("");
      setClients([]);
      setSelectedClientIds([]);
    }
  }, [isDialogOpen]);

  const handleEnroll = async () => {
    if (selectedClientIds.length === 0) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/programs/${programId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: selectedClientIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to enroll clients");
      }

      const result = await response.json();
      const successCount = result.data?.totalSuccessful || selectedClientIds.length;
      const failedCount = result.data?.totalFailed || 0;

      if (failedCount > 0) {
        toast.success(`Enrolled ${successCount} client${successCount !== 1 ? "s" : ""}. ${failedCount} already enrolled.`);
      } else {
        toast.success(`${successCount} client${successCount !== 1 ? "s" : ""} enrolled successfully`);
      }
      setIsDialogOpen(false);
      setSelectedClientIds([]);
      setSearchQuery("");
      setClients([]);
      fetchEnrollments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enroll clients");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to withdraw this client from the program?")) return;

    try {
      const response = await fetch(
        `/api/programs/${programId}/enrollments/${enrollmentId}?action=withdraw`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to withdraw client");
      }

      toast.success("Client withdrawn from program");
      fetchEnrollments();
    } catch (error) {
      toast.error("Failed to withdraw client");
    }
  };

  const handleStatusChange = async (enrollmentId: string, status: EnrollmentStatus) => {
    try {
      const response = await fetch(`/api/programs/${programId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("Status updated");
      fetchEnrollments();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusColor = (status: EnrollmentStatus) => {
    const colors: Record<EnrollmentStatus, string> = {
      ENROLLED: "bg-blue-100 text-blue-800",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      WITHDRAWN: "bg-gray-100 text-gray-800",
      FAILED: "bg-red-100 text-red-800",
      ON_HOLD: "bg-orange-100 text-orange-800",
    };
    return colors[status] || "";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Enrollments</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Enroll Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enroll Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Search Clients</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Search results as inline clickable list */}
              {searchQuery.length >= 2 && (
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {clients.length === 0 && !isSearching ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No clients found
                    </div>
                  ) : (
                    clients.map((client) => {
                      const isEnrolled = enrolledClientIds.has(client.id);
                      const isSelected = selectedClientIds.includes(client.id);

                      return (
                        <div
                          key={client.id}
                          onClick={() => !isEnrolled && toggleClient(client.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted transition-colors",
                            isEnrolled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                            isSelected && !isEnrolled && "bg-primary/10"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isEnrolled}
                            onCheckedChange={() => !isEnrolled && toggleClient(client.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {client.phone}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {client.lastActivityAt
                                ? format(new Date(client.lastActivityAt), "MMM d")
                                : "No activity"}
                            </span>
                            {isEnrolled && (
                              <Badge variant="secondary" className="text-xs">
                                Enrolled
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEnroll}
                  disabled={selectedClientIds.length === 0 || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enroll{selectedClientIds.length > 0
                    ? ` ${selectedClientIds.length} Client${selectedClientIds.length > 1 ? "s" : ""}`
                    : ""}
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
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No enrollments yet</p>
            <p className="text-sm">Enroll clients to track their participation</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hours Progress</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => {
                const progress = requiredHours
                  ? Math.min((enrollment.effectiveHours / requiredHours) * 100, 100)
                  : 0;

                return (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {enrollment.client?.firstName} {enrollment.client?.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {enrollment.client?.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(enrollment.enrolledDate), "MMM d, yyyy")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={enrollment.status}
                        onValueChange={(value) =>
                          handleStatusChange(enrollment.id, value as EnrollmentStatus)
                        }
                      >
                        <SelectTrigger className="w-[130px]">
                          <Badge className={getStatusColor(enrollment.status)}>
                            {enrollment.status.replace("_", " ")}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EnrollmentStatus.ENROLLED}>Enrolled</SelectItem>
                          <SelectItem value={EnrollmentStatus.IN_PROGRESS}>In Progress</SelectItem>
                          <SelectItem value={EnrollmentStatus.COMPLETED}>Completed</SelectItem>
                          <SelectItem value={EnrollmentStatus.ON_HOLD}>On Hold</SelectItem>
                          <SelectItem value={EnrollmentStatus.FAILED}>Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 w-20" />
                          <span className="text-sm text-muted-foreground">
                            {enrollment.effectiveHours}
                            {requiredHours ? ` / ${requiredHours}` : ""} hrs
                          </span>
                        </div>
                        {enrollment.hoursOverride !== null && (
                          <span className="text-xs text-muted-foreground">(manual override)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleWithdraw(enrollment.id)}
                        title="Withdraw from program"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
