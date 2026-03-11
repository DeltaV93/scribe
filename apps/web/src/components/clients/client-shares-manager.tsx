"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ClientShareBadge } from "./client-share-badge";
import { ClientShareDialog } from "./client-share-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ClientShare {
  id: string;
  clientId: string;
  permission: "VIEW" | "EDIT" | "FULL";
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  revokedAt: string | null;
  sharedWithUser: {
    id: string;
    name: string | null;
    email: string;
  };
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ClientSharesManagerProps {
  clientId: string;
  clientName: string;
  currentAssignedUserId: string;
  canManageShares?: boolean;
}

export function ClientSharesManager({
  clientId,
  clientName,
  currentAssignedUserId,
  canManageShares = true,
}: ClientSharesManagerProps) {
  const [shares, setShares] = useState<ClientShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareToRevoke, setShareToRevoke] = useState<ClientShare | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    fetchShares();
  }, [clientId]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/shares`);
      if (response.ok) {
        const data = await response.json();
        setShares(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching shares:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!shareToRevoke) return;

    setIsRevoking(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/shares/${shareToRevoke.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to revoke share");
      }

      toast.success("Share revoked successfully");
      setShareToRevoke(null);
      fetchShares();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke share"
      );
    } finally {
      setIsRevoking(false);
    }
  };

  const isExpiringSoon = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return expirationDate <= threeDaysFromNow;
  };

  const isExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Filter out expired shares from display
  const activeShares = shares.filter((share) => !isExpired(share.expiresAt));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Shared Access
            </CardTitle>
            <CardDescription>
              Team members who have access to this client
            </CardDescription>
          </div>
          {canManageShares && (
            <Button onClick={() => setShowShareDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Share
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeShares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                This client is not shared with anyone.
              </p>
              {canManageShares && (
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setShowShareDialog(true)}
                >
                  Share with a team member
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {activeShares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {share.sharedWithUser.name ||
                          share.sharedWithUser.email}
                      </span>
                      <ClientShareBadge
                        permission={share.permission}
                        compact
                        expiresAt={share.expiresAt}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {share.sharedWithUser.email}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        Shared{" "}
                        {formatDistanceToNow(new Date(share.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {share.expiresAt && (
                        <span
                          className={`flex items-center gap-1 ${
                            isExpiringSoon(share.expiresAt)
                              ? "text-warning"
                              : ""
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          Expires{" "}
                          {format(new Date(share.expiresAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    {share.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {share.notes}
                      </p>
                    )}
                  </div>
                  {canManageShares && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setShareToRevoke(share)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <ClientShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        clientId={clientId}
        clientName={clientName}
        currentAssignedUserId={currentAssignedUserId}
        onShareCreated={fetchShares}
      />

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={!!shareToRevoke}
        onOpenChange={(open) => !open && setShareToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Revoke Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke{" "}
              <span className="font-medium">
                {shareToRevoke?.sharedWithUser.name ||
                  shareToRevoke?.sharedWithUser.email}
              </span>
              &apos;s access to this client? They will no longer be able to view
              or interact with this client&apos;s data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeShare}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
