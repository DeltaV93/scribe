"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Payer {
  code: string;
  name: string;
  type: "commercial" | "medicaid" | "medicare" | "other";
  supportsRealTime: boolean;
}

interface InsuranceFormProps {
  clientId: string;
  initialData?: {
    id?: string;
    planName: string;
    memberId: string;
    groupNumber?: string | null;
    payerCode?: string | null;
    payerName?: string | null;
    effectiveDate: Date | string;
    terminationDate?: Date | null;
    isPrimary: boolean;
    subscriberName?: string | null;
    subscriberDob?: Date | null;
    subscriberRelation?: string | null;
    planType?: string | null;
    planPhone?: string | null;
  };
  payers: Payer[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InsuranceForm({
  clientId,
  initialData,
  payers,
  onSuccess,
  onCancel,
}: InsuranceFormProps) {
  const isEdit = !!initialData?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubscriber, setShowSubscriber] = useState(
    initialData?.subscriberRelation !== "self" && !!initialData?.subscriberName
  );

  const [formData, setFormData] = useState({
    planName: initialData?.planName || "",
    memberId: initialData?.memberId || "",
    groupNumber: initialData?.groupNumber || "",
    payerCode: initialData?.payerCode || "",
    payerName: initialData?.payerName || "",
    effectiveDate: initialData?.effectiveDate
      ? new Date(initialData.effectiveDate).toISOString().split("T")[0]
      : "",
    terminationDate: initialData?.terminationDate
      ? new Date(initialData.terminationDate).toISOString().split("T")[0]
      : "",
    isPrimary: initialData?.isPrimary ?? true,
    subscriberName: initialData?.subscriberName || "",
    subscriberDob: initialData?.subscriberDob
      ? new Date(initialData.subscriberDob).toISOString().split("T")[0]
      : "",
    subscriberRelation: initialData?.subscriberRelation || "self",
    planType: initialData?.planType || "",
    planPhone: initialData?.planPhone || "",
  });

  const handlePayerChange = (payerCode: string) => {
    const selectedPayer = payers.find((p) => p.code === payerCode);
    setFormData((prev) => ({
      ...prev,
      payerCode,
      payerName: selectedPayer?.name || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/clients/${clientId}/insurance/${initialData.id}`
        : `/api/clients/${clientId}/insurance`;

      const method = isEdit ? "PATCH" : "POST";

      const body = {
        ...formData,
        groupNumber: formData.groupNumber || null,
        terminationDate: formData.terminationDate || null,
        subscriberName: showSubscriber ? formData.subscriberName : null,
        subscriberDob: showSubscriber && formData.subscriberDob ? formData.subscriberDob : null,
        subscriberRelation: showSubscriber ? formData.subscriberRelation : "self",
        planType: formData.planType || null,
        planPhone: formData.planPhone || null,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save insurance");
      }

      toast.success(
        isEdit ? "Insurance updated successfully" : "Insurance added successfully"
      );
      onSuccess?.();
    } catch (error) {
      console.error("Error saving insurance:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save insurance"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Insurance" : "Add Insurance"}</CardTitle>
        <CardDescription>
          Enter the client&apos;s insurance information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Plan Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payerCode">Insurance Company *</Label>
                <Select
                  value={formData.payerCode}
                  onValueChange={handlePayerChange}
                >
                  <SelectTrigger id="payerCode">
                    <SelectValue placeholder="Select insurer" />
                  </SelectTrigger>
                  <SelectContent>
                    {payers.map((payer) => (
                      <SelectItem key={payer.code} value={payer.code}>
                        {payer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name *</Label>
                <Input
                  id="planName"
                  value={formData.planName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, planName: e.target.value }))
                  }
                  placeholder="e.g., Gold PPO"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="memberId">Member ID *</Label>
                <Input
                  id="memberId"
                  value={formData.memberId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, memberId: e.target.value }))
                  }
                  placeholder="Enter member ID"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupNumber">Group Number</Label>
                <Input
                  id="groupNumber"
                  value={formData.groupNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, groupNumber: e.target.value }))
                  }
                  placeholder="Enter group number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planType">Plan Type</Label>
                <Select
                  value={formData.planType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, planType: value }))
                  }
                >
                  <SelectTrigger id="planType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PPO">PPO</SelectItem>
                    <SelectItem value="HMO">HMO</SelectItem>
                    <SelectItem value="EPO">EPO</SelectItem>
                    <SelectItem value="POS">POS</SelectItem>
                    <SelectItem value="HDHP">HDHP</SelectItem>
                    <SelectItem value="Medicare">Medicare</SelectItem>
                    <SelectItem value="Medicaid">Medicaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planPhone">Plan Phone</Label>
                <Input
                  id="planPhone"
                  value={formData.planPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, planPhone: e.target.value }))
                  }
                  placeholder="1-800-xxx-xxxx"
                />
              </div>
            </div>
          </div>

          {/* Coverage Dates */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Coverage Dates</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date *</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      effectiveDate: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terminationDate">Termination Date</Label>
                <Input
                  id="terminationDate"
                  type="date"
                  value={formData.terminationDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      terminationDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Primary Insurance */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrimary"
              checked={formData.isPrimary}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isPrimary: checked as boolean }))
              }
            />
            <Label htmlFor="isPrimary" className="text-sm font-normal">
              This is the primary insurance
            </Label>
          </div>

          {/* Subscriber Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showSubscriber"
                checked={showSubscriber}
                onCheckedChange={(checked) => setShowSubscriber(checked as boolean)}
              />
              <Label htmlFor="showSubscriber" className="text-sm font-normal">
                Client is not the policy holder (dependent)
              </Label>
            </div>

            {showSubscriber && (
              <div className="ml-6 space-y-4 border-l-2 border-muted pl-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subscriberName">Subscriber Name</Label>
                    <Input
                      id="subscriberName"
                      value={formData.subscriberName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          subscriberName: e.target.value,
                        }))
                      }
                      placeholder="Policy holder name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subscriberRelation">Relationship</Label>
                    <Select
                      value={formData.subscriberRelation}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          subscriberRelation: value,
                        }))
                      }
                    >
                      <SelectTrigger id="subscriberRelation">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscriberDob">Subscriber Date of Birth</Label>
                  <Input
                    id="subscriberDob"
                    type="date"
                    value={formData.subscriberDob}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        subscriberDob: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update Insurance" : "Add Insurance"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
