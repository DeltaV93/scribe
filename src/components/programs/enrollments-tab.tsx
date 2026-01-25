"use client";

import { useState, useEffect } from "react";
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
import { EnrollmentStatus } from "@prisma/client";
import { Plus, Search, Loader2, UserMinus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [selectedClientId, setSelectedClientId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [requiredHours, setRequiredHours] = useState<number | null>(null);

  const fetchEnrollments = async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/enrollments`);
      if (response.ok) {
        const data = await response.json();
        setEnrollments(data.data);
        if (data.data[0]?.program?.requiredHours) {
          setRequiredHours(data.data[0].program.requiredHours);
        }
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async (search: string) => {
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(search)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [programId]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      fetchClients(searchQuery);
    }
  }, [searchQuery]);

  const handleEnroll = async () => {
    if (!selectedClientId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/programs/${programId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to enroll client");
      }

      toast.success("Client enrolled successfully");
      setIsDialogOpen(false);
      setSelectedClientId("");
      setSearchQuery("");
      fetchEnrollments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enroll client");
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
                <Label>Search Client</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Client</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.firstName} {client.lastName} - {client.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEnroll} disabled={!selectedClientId || isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enroll
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
