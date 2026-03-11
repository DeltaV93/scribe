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
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";
import { PurchaseNumberDialog } from "./purchase-number-dialog";
import { format } from "date-fns";

interface PoolNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
  purchasedAt: string;
  monthlyCost: number;
}

interface AssignedNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
  provisionedAt: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
}

interface PhoneNumbersTabProps {
  onDataChange: () => void;
  pricePerNumber?: number;
}

export function PhoneNumbersTab({ onDataChange, pricePerNumber }: PhoneNumbersTabProps) {
  const [poolNumbers, setPoolNumbers] = useState<PoolNumber[]>([]);
  const [assignedNumbers, setAssignedNumbers] = useState<AssignedNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<{
    id: string;
    type: "pool" | "assigned";
    phoneNumber: string;
    userId?: string;
  } | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [poolRes, statsRes] = await Promise.all([
        fetch("/api/admin/phone-numbers/pool"),
        fetch("/api/admin/phone-numbers/stats"),
      ]);

      if (poolRes.ok) {
        const poolData = await poolRes.json();
        setPoolNumbers(poolData.data);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAssignedNumbers(statsData.data.assignedNumbers);
      }
    } catch (error) {
      console.error("Failed to fetch phone numbers:", error);
      toast.error("Failed to load phone numbers");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (areaCode?: string) => {
    setIsPurchasing(true);
    try {
      const response = await fetch("/api/admin/phone-numbers/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to purchase number");
      }

      toast.success("Phone number purchased successfully");
      setShowPurchaseDialog(false);
      fetchData();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to purchase number");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRelease = async () => {
    if (!releaseTarget) return;

    setIsReleasing(true);
    try {
      let response: Response;

      if (releaseTarget.type === "pool") {
        response = await fetch(`/api/admin/phone-numbers/pool/${releaseTarget.id}`, {
          method: "DELETE",
        });
      } else {
        response = await fetch(
          `/api/admin/phone-numbers/assign/${releaseTarget.userId}`,
          { method: "DELETE" }
        );
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to release number");
      }

      toast.success("Phone number released");
      setReleaseTarget(null);
      fetchData();
      onDataChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to release number");
    } finally {
      setIsReleasing(false);
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
      {/* Pool Numbers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Phone Number Pool</CardTitle>
            <CardDescription>
              Unassigned numbers available to assign to case managers
            </CardDescription>
          </div>
          <Button onClick={() => setShowPurchaseDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Purchase Number
          </Button>
        </CardHeader>
        <CardContent>
          {poolNumbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No numbers in pool</p>
              <p className="text-sm">Purchase numbers to add them to the pool</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Area Code</TableHead>
                  <TableHead>Purchased</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolNumbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono">
                      {formatPhoneNumber(number.phoneNumber)}
                    </TableCell>
                    <TableCell>{number.areaCode}</TableCell>
                    <TableCell>
                      {format(new Date(number.purchasedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>${number.monthlyCost.toFixed(2)}/mo</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setReleaseTarget({
                            id: number.id,
                            type: "pool",
                            phoneNumber: number.phoneNumber,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assigned Numbers */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Numbers</CardTitle>
          <CardDescription>
            Numbers currently assigned to case managers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedNumbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No numbers assigned yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedNumbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono">
                      {formatPhoneNumber(number.phoneNumber)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {number.userName || "Unnamed"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {number.userEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{number.userRole}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(number.provisionedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setReleaseTarget({
                            id: number.id,
                            type: "assigned",
                            phoneNumber: number.phoneNumber,
                            userId: number.userId,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Purchase Dialog */}
      <PurchaseNumberDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        pricePerNumber={pricePerNumber}
      />

      {/* Release Confirmation Dialog */}
      <AlertDialog
        open={!!releaseTarget}
        onOpenChange={() => setReleaseTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Phone Number?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently release {releaseTarget?.phoneNumber}. This
              action cannot be undone and you will need to purchase a new number
              if you want to use it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReleasing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRelease}
              disabled={isReleasing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isReleasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Release Number"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
