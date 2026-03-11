"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, PhoneOff, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AssignNumberDialog } from "./assign-number-dialog";

interface UserWithPhoneStatus {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phoneNumber: string | null;
  hasPendingRequest: boolean;
  requestId: string | null;
}

interface PhoneRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  requestedAt: string;
}

interface PoolNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
}

interface UsersTabProps {
  pendingRequestCount: number;
  onDataChange: () => void;
  pricePerNumber?: number;
}

export function UsersTab({ pendingRequestCount, onDataChange, pricePerNumber }: UsersTabProps) {
  const [users, setUsers] = useState<UserWithPhoneStatus[]>([]);
  const [requests, setRequests] = useState<PhoneRequest[]>([]);
  const [poolNumbers, setPoolNumbers] = useState<PoolNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{
    userId: string;
    userName: string;
    requestId?: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, requestsRes, poolRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/phone-requests"),
        fetch("/api/admin/phone-numbers/pool"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.data);
      }

      if (poolRes.ok) {
        const data = await poolRes.json();
        setPoolNumbers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, poolNumberId?: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await fetch(`/api/admin/phone-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", poolNumberId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve request");
      }

      toast.success("Request approved and number assigned");
      fetchData();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve request");
    } finally {
      setProcessingRequest(null);
      setAssignTarget(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const response = await fetch(`/api/admin/phone-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject request");
      }

      toast.success("Request rejected");
      fetchData();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject request");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDirectAssign = async (userId: string, poolNumberId?: string) => {
    try {
      const response = await fetch("/api/admin/phone-numbers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, poolNumberId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign number");
      }

      toast.success("Number assigned successfully");
      fetchData();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign number");
    } finally {
      setAssignTarget(null);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {requests.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Requests ({requests.length})
            </CardTitle>
            <CardDescription>
              Case managers requesting phone numbers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {request.userName || "Unnamed"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.userEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{request.userRole}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            setAssignTarget({
                              userId: request.userId,
                              userName: request.userName || request.userEmail,
                              requestId: request.id,
                            })
                          }
                          disabled={processingRequest === request.id}
                        >
                          {processingRequest === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={processingRequest === request.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage phone number assignments for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name || "Unnamed"}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.phoneNumber ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-green-600" />
                        <span className="font-mono text-sm">
                          {formatPhoneNumber(user.phoneNumber)}
                        </span>
                      </div>
                    ) : user.hasPendingRequest ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-muted-foreground">
                          Request pending
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <PhoneOff className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          No number
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {!user.phoneNumber && !user.hasPendingRequest && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAssignTarget({
                            userId: user.id,
                            userName: user.name || user.email,
                          })
                        }
                      >
                        Assign
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Number Dialog */}
      <AssignNumberDialog
        open={!!assignTarget}
        onOpenChange={() => setAssignTarget(null)}
        userName={assignTarget?.userName || ""}
        poolNumbers={poolNumbers}
        pricePerNumber={pricePerNumber}
        onAssign={(poolNumberId) => {
          if (assignTarget?.requestId) {
            handleApproveRequest(assignTarget.requestId, poolNumberId);
          } else if (assignTarget) {
            handleDirectAssign(assignTarget.userId, poolNumberId);
          }
        }}
      />
    </div>
  );
}
