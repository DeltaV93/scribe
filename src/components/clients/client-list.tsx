"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ClientStatusBadge } from "./client-status-badge";
import { ClientStatus } from "@prisma/client";
import { Loader2, Plus, Search, Phone, Mail, User, PhoneCall } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FormSelectionModal } from "@/components/calls/form-selection-modal";
import { toast } from "sonner";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: ClientStatus;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    calls: number;
    notes: number;
    formSubmissions: number;
  };
  updatedAt: string;
}

interface ClientListProps {
  showAssignedFilter?: boolean;
}

export function ClientList({ showAssignedFilter = true }: ClientListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Call modal state
  const [showCallModal, setShowCallModal] = useState(false);
  const [selectedClientForCall, setSelectedClientForCall] = useState<Client | null>(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [isCheckingLock, setIsCheckingLock] = useState<string | null>(null);

  // User's phone status for making calls
  const [phoneStatus, setPhoneStatus] = useState<{
    hasPhoneNumber: boolean;
    phoneNumber: string | null;
    hasPendingRequest: boolean;
  } | null>(null);
  const [isLoadingPhoneStatus, setIsLoadingPhoneStatus] = useState(true);

  // Fetch user's phone status
  useEffect(() => {
    const fetchPhoneStatus = async () => {
      setIsLoadingPhoneStatus(true);
      try {
        const response = await fetch("/api/phone-numbers/my-status");
        if (response.ok) {
          const data = await response.json();
          setPhoneStatus(data.data);
        }
      } catch (error) {
        console.error("Error fetching phone status:", error);
      } finally {
        setIsLoadingPhoneStatus(false);
      }
    };

    fetchPhoneStatus();
  }, []);

  // Check if client is locked before allowing call
  const checkClientLock = useCallback(async (clientId: string): Promise<boolean> => {
    try {
      const params = new URLSearchParams({
        resourceType: "client",
        resourceId: clientId,
      });
      const response = await fetch(`/api/locks?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.data?.locked && !data.data?.isOwnLock) {
          toast.error(`${data.data.lockedBy || "Another user"} is currently on a call with this client`);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error("Error checking lock:", error);
    }
    return true; // Allow call if check fails (optimistic)
  }, []);

  // Handle call button click
  const handleCallClick = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation(); // Prevent row click navigation

    // Check if user has phone number assigned
    if (!phoneStatus?.hasPhoneNumber) {
      toast.error("You need a phone number assigned to make calls");
      return;
    }

    // Check if client has a phone number
    if (!client.phone) {
      toast.error("Client has no phone number");
      return;
    }

    setIsCheckingLock(client.id);
    const canProceed = await checkClientLock(client.id);
    setIsCheckingLock(null);

    if (canProceed) {
      setSelectedClientForCall(client);
      setShowCallModal(true);
    }
  };

  // Initiate the call
  const handleInitiateCall = async (formIds: string[]) => {
    if (!selectedClientForCall) return;

    setIsInitiatingCall(true);
    try {
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientForCall.id, formIds }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/calls/${data.data.id}`);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error?.message || "Failed to initiate call");
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      toast.error("Failed to initiate call");
    } finally {
      setIsInitiatingCall(false);
      setShowCallModal(false);
      setSelectedClientForCall(null);
    }
  };

  // Get tooltip message for disabled call button
  const getCallButtonTooltip = (client: Client): string | null => {
    if (isLoadingPhoneStatus) return "Loading...";
    if (!phoneStatus?.hasPhoneNumber) {
      return phoneStatus?.hasPendingRequest
        ? "Your phone number request is pending"
        : "Request a phone number to make calls";
    }
    if (!client.phone) return "Client has no phone number";
    return null;
  };

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setIsLoading(false);
    }
  }, [search, status, pagination.page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={ClientStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={ClientStatus.ON_HOLD}>On Hold</SelectItem>
              <SelectItem value={ClientStatus.PENDING}>Pending</SelectItem>
              <SelectItem value={ClientStatus.CLOSED}>Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => router.push("/clients/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              {showAssignedFilter && <TableHead>Assigned To</TableHead>}
              <TableHead>Activity</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showAssignedFilter ? 7 : 6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showAssignedFilter ? 7 : 6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No clients found</p>
                    {search && <p className="text-sm">Try adjusting your search</p>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell>
                    <div className="font-medium">
                      {client.firstName} {client.lastName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {formatPhone(client.phone)}
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={client.status} />
                  </TableCell>
                  {showAssignedFilter && (
                    <TableCell>
                      {client.assignedUser?.name || client.assignedUser?.email || "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {client._count && (
                        <>
                          {client._count.calls} calls, {client._count.formSubmissions} forms
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleCallClick(e, client)}
                              disabled={
                                isLoadingPhoneStatus ||
                                !phoneStatus?.hasPhoneNumber ||
                                !client.phone ||
                                isCheckingLock === client.id
                              }
                            >
                              {isCheckingLock === client.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PhoneCall className="h-4 w-4" />
                              )}
                              <span className="sr-only">Call {client.firstName} {client.lastName}</span>
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {getCallButtonTooltip(client) && (
                          <TooltipContent>
                            <p>{getCallButtonTooltip(client)}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Call Modal */}
      <FormSelectionModal
        open={showCallModal}
        onOpenChange={(open) => {
          setShowCallModal(open);
          if (!open) setSelectedClientForCall(null);
        }}
        onConfirm={handleInitiateCall}
        clientName={selectedClientForCall ? `${selectedClientForCall.firstName} ${selectedClientForCall.lastName}` : ""}
        isLoading={isInitiatingCall}
      />
    </div>
  );
}
