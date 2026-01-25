"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Phone, ShoppingCart } from "lucide-react";

interface PoolNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
}

interface AssignNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  poolNumbers: PoolNumber[];
  onAssign: (poolNumberId?: string) => void;
  pricePerNumber?: number;
}

export function AssignNumberDialog({
  open,
  onOpenChange,
  userName,
  poolNumbers,
  onAssign,
  pricePerNumber = 5.0,
}: AssignNumberDialogProps) {
  const [selectedOption, setSelectedOption] = useState<string>("purchase");
  const [isAssigning, setIsAssigning] = useState(false);

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      if (selectedOption === "purchase") {
        await onAssign(undefined);
      } else {
        await onAssign(selectedOption);
      }
    } finally {
      setIsAssigning(false);
      setSelectedOption("purchase");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Phone Number</DialogTitle>
          <DialogDescription>
            Assign a phone number to {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
            {/* Purchase new option */}
            <div className="flex items-center space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="purchase" id="purchase" />
              <Label
                htmlFor="purchase"
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Purchase New Number</p>
                  <p className="text-sm text-muted-foreground">
                    Purchase a new number (${pricePerNumber.toFixed(2)}/month)
                  </p>
                </div>
              </Label>
            </div>

            {/* Pool numbers */}
            {poolNumbers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Or assign from pool:
                </p>
                {poolNumbers.map((number) => (
                  <div
                    key={number.id}
                    className="flex items-center space-x-3 rounded-lg border p-4"
                  >
                    <RadioGroupItem value={number.id} id={number.id} />
                    <Label
                      htmlFor={number.id}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-mono font-medium">
                          {formatPhoneNumber(number.phoneNumber)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Area code: {number.areaCode}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {poolNumbers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No numbers in pool. A new number will be purchased.
              </p>
            )}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning}>
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Number"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
