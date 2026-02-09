"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  CreditCard,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle,
  Phone,
  Calendar,
} from "lucide-react";

interface InsuranceCardProps {
  insurance: {
    id: string;
    clientId: string;
    planName: string;
    memberId: string;
    groupNumber: string | null;
    payerName: string | null;
    effectiveDate: Date | string;
    terminationDate: Date | null;
    isPrimary: boolean;
    planType: string | null;
    planPhone: string | null;
    _count?: {
      eligibilityChecks: number;
    };
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onCheckEligibility?: () => void;
}

export function InsuranceCard({
  insurance,
  onEdit,
  onDelete,
  onCheckEligibility,
}: InsuranceCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const effectiveDate = new Date(insurance.effectiveDate);
  const terminationDate = insurance.terminationDate
    ? new Date(insurance.terminationDate)
    : null;

  const isActive =
    effectiveDate <= new Date() &&
    (!terminationDate || terminationDate >= new Date());

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/clients/${insurance.clientId}/insurance/${insurance.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete insurance");
      }

      toast.success("Insurance deleted successfully");
      onDelete?.();
    } catch (error) {
      console.error("Error deleting insurance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete insurance"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className={insurance.isPrimary ? "border-primary" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{insurance.planName}</CardTitle>
                <CardDescription>
                  {insurance.payerName || "Insurance"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {insurance.isPrimary && (
                <Badge variant="default">Primary</Badge>
              )}
              {isActive ? (
                <Badge variant="outline" className="border-green-500 text-green-700">
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-500 text-red-700">
                  Inactive
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onCheckEligibility && isActive && (
                    <DropdownMenuItem onClick={onCheckEligibility}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Check Eligibility
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Member ID</span>
              <p className="font-medium">{insurance.memberId}</p>
            </div>
            {insurance.groupNumber && (
              <div>
                <span className="text-muted-foreground">Group Number</span>
                <p className="font-medium">{insurance.groupNumber}</p>
              </div>
            )}
            {insurance.planType && (
              <div>
                <span className="text-muted-foreground">Plan Type</span>
                <p className="font-medium">{insurance.planType}</p>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {effectiveDate.toLocaleDateString()}
                {terminationDate && ` - ${terminationDate.toLocaleDateString()}`}
              </span>
            </div>
            {insurance.planPhone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{insurance.planPhone}</span>
              </div>
            )}
          </div>

          {insurance._count && insurance._count.eligibilityChecks > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              {insurance._count.eligibilityChecks} eligibility check
              {insurance._count.eligibilityChecks !== 1 ? "s" : ""} on file
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Insurance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this insurance record? This action
              cannot be undone and will remove all associated eligibility checks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
