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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  Clock,
  DollarSign,
  Loader2,
} from "lucide-react";

interface EligibilityResultProps {
  result: {
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
  };
  clientId: string;
  onClose?: () => void;
  onNewCheck?: () => void;
  showActions?: boolean;
}

export function EligibilityResult({
  result,
  clientId,
  onClose,
  onNewCheck,
  showActions = true,
}: EligibilityResultProps) {
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);

  const checkedAt = new Date(result.checkedAt);
  const expiresAt = new Date(result.expiresAt);
  const { responseData } = result;

  const handleGenerateDocuments = async (type: "summary" | "cms1500" | "all") => {
    setIsGeneratingDocs(true);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/eligibility/${result.id}/documents?type=${type}`,
        { method: "GET" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to generate documents");
      }

      const data = await response.json();

      // Open documents in new tabs
      for (const doc of data.data.documents) {
        window.open(doc.url, "_blank");
      }

      toast.success("Documents generated successfully");
    } catch (error) {
      console.error("Error generating documents:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate documents"
      );
    } finally {
      setIsGeneratingDocs(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {result.isEligible ? (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800">Eligible</AlertTitle>
          <AlertDescription className="text-green-700">
            Client is eligible for {result.serviceName || result.serviceCode} coverage
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-red-500 bg-red-50">
          <XCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-800">Not Eligible</AlertTitle>
          <AlertDescription className="text-red-700">
            Client is not eligible for {result.serviceName || result.serviceCode} coverage
          </AlertDescription>
        </Alert>
      )}

      {/* Prior Auth Warning */}
      {responseData.priorAuthRequired && (
        <Alert className="border-orange-500 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-800">Prior Authorization Required</AlertTitle>
          <AlertDescription className="text-orange-700">
            This service requires prior authorization.
            {responseData.priorAuthPhone && (
              <> Contact: {responseData.priorAuthPhone}</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Plan Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan Information</CardTitle>
          <CardDescription>
            {responseData.planName} - {responseData.memberId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {responseData.groupNumber && (
              <div>
                <span className="text-muted-foreground">Group Number</span>
                <p className="font-medium">{responseData.groupNumber}</p>
              </div>
            )}
            {responseData.effectiveDate && (
              <div>
                <span className="text-muted-foreground">Effective Date</span>
                <p className="font-medium">
                  {new Date(responseData.effectiveDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {responseData.terminationDate && (
              <div>
                <span className="text-muted-foreground">Termination Date</span>
                <p className="font-medium">
                  {new Date(responseData.terminationDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Sharing */}
      {result.isEligible && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Cost Sharing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {responseData.copay !== undefined && (
                <div>
                  <span className="text-muted-foreground">Copay</span>
                  <p className="font-medium">
                    ${responseData.copay.toFixed(2)}
                    {responseData.copayDescription && (
                      <span className="text-muted-foreground ml-1">
                        ({responseData.copayDescription})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {responseData.deductible !== undefined && (
                <div>
                  <span className="text-muted-foreground">Deductible</span>
                  <p className="font-medium">
                    ${responseData.deductible.toFixed(2)}
                    {responseData.deductibleRemaining !== undefined && (
                      <span className="text-green-600 ml-1">
                        (${responseData.deductibleRemaining.toFixed(2)} remaining)
                      </span>
                    )}
                  </p>
                </div>
              )}
              {responseData.coinsurance !== undefined && (
                <div>
                  <span className="text-muted-foreground">Coinsurance</span>
                  <p className="font-medium">{responseData.coinsurance}%</p>
                </div>
              )}
              {responseData.outOfPocketMax !== undefined && (
                <div>
                  <span className="text-muted-foreground">Out-of-Pocket Max</span>
                  <p className="font-medium">
                    ${responseData.outOfPocketMax.toFixed(2)}
                    {responseData.outOfPocketRemaining !== undefined && (
                      <span className="text-green-600 ml-1">
                        (${responseData.outOfPocketRemaining.toFixed(2)} remaining)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limitations */}
      {responseData.limitations && responseData.limitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Limitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {responseData.limitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Verification Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Checked {checkedAt.toLocaleString()}
            {result.isFromCache && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Cached
              </Badge>
            )}
          </span>
        </div>
        <span>Valid until {expiresAt.toLocaleDateString()}</span>
      </div>

      <Separator />

      {/* Actions */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateDocuments("summary")}
            disabled={isGeneratingDocs}
          >
            {isGeneratingDocs ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Eligibility Summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateDocuments("cms1500")}
            disabled={isGeneratingDocs}
          >
            {isGeneratingDocs ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            CMS-1500 Form
          </Button>

          <div className="flex-1" />

          {onNewCheck && (
            <Button variant="outline" size="sm" onClick={onNewCheck}>
              <RefreshCw className="mr-2 h-4 w-4" />
              New Check
            </Button>
          )}
          {onClose && (
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
