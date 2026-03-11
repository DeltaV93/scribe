"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientStatusBadge } from "./client-status-badge";
import { ClientShareBadge } from "./client-share-badge";
import { Loader2, Eye, Users, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ClientStatus } from "@prisma/client";

interface SharedClient {
  id: string;
  clientId: string;
  permission: "VIEW" | "EDIT" | "FULL";
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    status: ClientStatus;
    assignedUser: {
      id: string;
      name: string | null;
      email: string;
    };
  };
}

export function SharedClientsList() {
  const router = useRouter();
  const [sharedClients, setSharedClients] = useState<SharedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSharedClients();
  }, []);

  const fetchSharedClients = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/shared-clients");
      if (response.ok) {
        const data = await response.json();
        setSharedClients(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching shared clients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const isExpiringSoon = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return expirationDate <= threeDaysFromNow;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shared With Me
          </CardTitle>
          <CardDescription>
            Clients that other team members have shared with you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sharedClients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shared With Me
          </CardTitle>
          <CardDescription>
            Clients that other team members have shared with you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No clients have been shared with you yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              When a team member shares a client with you, they will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Shared With Me
          <Badge variant="secondary" className="ml-2">
            {sharedClients.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Clients that other team members have shared with you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Shared By</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharedClients.map((share) => (
                <TableRow key={share.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {share.client.firstName} {share.client.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPhone(share.client.phone)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={share.client.status} />
                  </TableCell>
                  <TableCell>
                    <ClientShareBadge permission={share.permission} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {share.sharedByUser.name || share.sharedByUser.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(share.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {share.expiresAt ? (
                      <div
                        className={`text-sm ${
                          isExpiringSoon(share.expiresAt)
                            ? "text-warning font-medium"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {isExpiringSoon(share.expiresAt) && (
                            <Clock className="h-3 w-3" />
                          )}
                          {format(new Date(share.expiresAt), "MMM d, yyyy")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No expiration
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/clients/${share.client.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
