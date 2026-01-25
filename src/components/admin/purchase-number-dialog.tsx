"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PurchaseNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase: (areaCode?: string) => void;
  isPurchasing: boolean;
  pricePerNumber?: number;
}

export function PurchaseNumberDialog({
  open,
  onOpenChange,
  onPurchase,
  isPurchasing,
  pricePerNumber = 5.0,
}: PurchaseNumberDialogProps) {
  const [areaCode, setAreaCode] = useState("");
  const [defaultAreaCode, setDefaultAreaCode] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchDefaultAreaCode();
    }
  }, [open]);

  const fetchDefaultAreaCode = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setDefaultAreaCode(data.data.preferredAreaCode);
      }
    } catch (error) {
      console.error("Failed to fetch default area code:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPurchase(areaCode || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase Phone Number</DialogTitle>
          <DialogDescription>
            Purchase a new phone number to add to your pool. Numbers cost
            ${pricePerNumber.toFixed(2)}/month.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="areaCode">Area Code (optional)</Label>
            <Input
              id="areaCode"
              placeholder={defaultAreaCode || "415"}
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              maxLength={3}
            />
            <p className="text-xs text-muted-foreground">
              {defaultAreaCode
                ? `Your organization default is ${defaultAreaCode}. Leave blank to use it.`
                : "Enter a 3-digit area code or leave blank for any available number."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPurchasing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPurchasing}>
              {isPurchasing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Purchasing...
                </>
              ) : (
                "Purchase Number"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
