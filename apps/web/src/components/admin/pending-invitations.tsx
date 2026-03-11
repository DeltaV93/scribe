"use client";

import { useState } from "react";
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
  Clock,
  Mail,
  MoreHorizontal,
  RefreshCw,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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

interface PendingInvitationsProps {
  invitations: Invitation[];
  onRefresh: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  PROGRAM_MANAGER: "Program Manager",
  CASE_MANAGER: "Case Manager",
  FACILITATOR: "Facilitator",
  VIEWER: "Viewer",
};

export function PendingInvitations({ invitations, onRefresh }: PendingInvitationsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "PENDING"
  );

  const handleResend = async (invitation: Invitation) => {
    setProcessingId(invitation.id);

    try {
      const response = await fetch(
        `/api/admin/users/invitations/${invitation.id}/resend`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend invitation");
      }

      toast.success(`Invitation resent to ${invitation.email}`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    setProcessingId(revokeTarget.id);

    try {
      const response = await fetch(
        `/api/admin/users/invitations/${revokeTarget.id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke invitation");
      }

      toast.success(`Invitation to ${revokeTarget.email} revoked`);
      setRevokeTarget(null);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke");
    } finally {
      setProcessingId(null);
    }
  };

  if (pendingInvitations.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-600" />
            Pending Invitations ({pendingInvitations.length})
          </CardTitle>
          <CardDescription>
            Invitations waiting to be accepted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{invitation.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {invitation.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ROLE_LABELS[invitation.role] || invitation.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">
                      {formatDistanceToNow(new Date(invitation.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {invitation.invitedBy.name || invitation.invitedBy.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {invitation.isExpired ? (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">Expired</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-sm text-muted-foreground">
                          Expires{" "}
                          {formatDistanceToNow(new Date(invitation.expiresAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    )}
                    {invitation.reminderSentAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reminder sent{" "}
                        {formatDistanceToNow(new Date(invitation.reminderSentAt), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={processingId === invitation.id}
                        >
                          {processingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleResend(invitation)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resend Invitation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRevokeTarget(invitation)}
                          className="text-destructive focus:text-destructive"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation to{" "}
              <strong>{revokeTarget?.email}</strong>?
              <br /><br />
              They will no longer be able to join using their current invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processingId}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!!processingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke Invitation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
