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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import { EligibilityResult } from "./eligibility-result";

// Common service codes for healthcare
const COMMON_SERVICE_CODES = [
  { code: "30", name: "Health Benefit Plan Coverage" },
  { code: "47", name: "Hospital" },
  { code: "48", name: "Hospital - Inpatient" },
  { code: "50", name: "Hospital - Outpatient" },
  { code: "33", name: "Chiropractic" },
  { code: "35", name: "Dental Care" },
  { code: "37", name: "Day Care (Psychiatric)" },
  { code: "38", name: "Mental Health" },
  { code: "39", name: "Substance Abuse" },
  { code: "42", name: "Home Health Care" },
  { code: "51", name: "Physician - Primary Care" },
  { code: "52", name: "Physician - Specialist" },
  { code: "86", name: "Emergency Services" },
  { code: "88", name: "Pharmacy" },
  { code: "98", name: "Professional (Physician) Services" },
  { code: "A4", name: "Speech Therapy" },
  { code: "A6", name: "Physical Therapy" },
  { code: "A7", name: "Occupational Therapy" },
  { code: "MH", name: "Mental Health Services" },
  { code: "UC", name: "Urgent Care" },
];

interface Insurance {
  id: string;
  planName: string;
  memberId: string;
  isPrimary: boolean;
}

interface EligibilityCheckerProps {
  clientId: string;
  insurances: Insurance[];
  providerNpi?: string;
  onCheckComplete?: (result: EligibilityCheckResult) => void;
}

interface EligibilityCheckResult {
  id: string;
  clientId: string;
  insurancePlanId: string | null;
  serviceCode: string;
  serviceName: string | null;
  isEligible: boolean;
  responseData: {
    planName: string;
    memberId: string;
    groupNumber?: string;
    effectiveDate?: string;
    terminationDate?: string;
    copay?: number;
    copayDescription?: string;
    deductible?: number;
    deductibleRemaining?: number;
    coinsurance?: number;
    outOfPocketMax?: number;
    outOfPocketRemaining?: number;
    priorAuthRequired?: boolean;
    priorAuthPhone?: string;
    limitations?: string[];
    notes?: string[];
  };
  checkedAt: Date | string;
  expiresAt: Date | string;
  isFromCache: boolean;
}

export function EligibilityChecker({
  clientId,
  insurances,
  providerNpi: defaultNpi = "",
  onCheckComplete,
}: EligibilityCheckerProps) {
  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<EligibilityCheckResult | null>(null);

  const [formData, setFormData] = useState({
    insurancePlanId: insurances.find((i) => i.isPrimary)?.id || "",
    serviceCode: "30", // Default to general health benefit
    serviceName: "Health Benefit Plan Coverage",
    providerNpi: defaultNpi,
  });

  const handleServiceCodeChange = (code: string) => {
    const service = COMMON_SERVICE_CODES.find((s) => s.code === code);
    setFormData((prev) => ({
      ...prev,
      serviceCode: code,
      serviceName: service?.name || code,
    }));
  };

  const handleCheck = async () => {
    if (!formData.providerNpi || formData.providerNpi.length !== 10) {
      toast.error("Please enter a valid 10-digit NPI");
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const response = await fetch(`/api/clients/${clientId}/eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurancePlanId: formData.insurancePlanId || undefined,
          serviceCode: formData.serviceCode,
          serviceName: formData.serviceName,
          providerNpi: formData.providerNpi,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to check eligibility");
      }

      const data = await response.json();
      setResult(data.data);
      onCheckComplete?.(data.data);

      if (data.data.isEligible) {
        toast.success("Client is eligible for coverage");
      } else {
        toast.warning("Client is not eligible for coverage");
      }
    } catch (error) {
      console.error("Error checking eligibility:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to check eligibility"
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCircle className="mr-2 h-4 w-4" />
          Check Eligibility
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Check Insurance Eligibility</DialogTitle>
          <DialogDescription>
            Verify if the client&apos;s insurance covers a specific service
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="insurancePlanId">Insurance Plan</Label>
              <Select
                value={formData.insurancePlanId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, insurancePlanId: value }))
                }
              >
                <SelectTrigger id="insurancePlanId">
                  <SelectValue placeholder="Select insurance plan" />
                </SelectTrigger>
                <SelectContent>
                  {insurances.map((insurance) => (
                    <SelectItem key={insurance.id} value={insurance.id}>
                      {insurance.planName}
                      {insurance.isPrimary && " (Primary)"}
                      {" - "}
                      {insurance.memberId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceCode">Service Type</Label>
              <Select
                value={formData.serviceCode}
                onValueChange={handleServiceCodeChange}
              >
                <SelectTrigger id="serviceCode">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SERVICE_CODES.map((service) => (
                    <SelectItem key={service.code} value={service.code}>
                      {service.name} ({service.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerNpi">Provider NPI *</Label>
              <Input
                id="providerNpi"
                value={formData.providerNpi}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, providerNpi: e.target.value }))
                }
                placeholder="10-digit NPI"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                The National Provider Identifier of the healthcare provider
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCheck} disabled={isChecking}>
                {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check Eligibility
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <EligibilityResult
              result={result}
              clientId={clientId}
              onClose={() => setOpen(false)}
              onNewCheck={() => setResult(null)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
