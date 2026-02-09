"use client";

import { useState, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { EligibilityResult } from "./eligibility-result";

interface EligibilityCheck {
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
    deductible?: number;
    coinsurance?: number;
    priorAuthRequired?: boolean;
  };
  checkedAt: Date | string;
  expiresAt: Date | string;
  isFromCache: boolean;
}

interface EligibilityHistoryProps {
  clientId: string;
  limit?: number;
}

export function EligibilityHistory({
  clientId,
  limit = 10,
}: EligibilityHistoryProps) {
  const [checks, setChecks] = useState<EligibilityCheck[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCheck, setSelectedCheck] = useState<EligibilityCheck | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [clientId, offset, limit]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/eligibility?limit=${limit}&offset=${offset}`
      );

      if (response.ok) {
        const data = await response.json();
        setChecks(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching eligibility history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility History</CardTitle>
          <CardDescription>No eligibility checks on file</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the &quot;Check Eligibility&quot; button to verify insurance coverage.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility History</CardTitle>
          <CardDescription>
            Past eligibility verifications for this client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((check) => {
                const checkedAt = new Date(check.checkedAt);
                const expiresAt = new Date(check.expiresAt);
                const isExpired = expiresAt < new Date();

                return (
                  <TableRow key={check.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {check.serviceName || check.serviceCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Code: {check.serviceCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{check.responseData.planName}</p>
                    </TableCell>
                    <TableCell>
                      {check.isEligible ? (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-700"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Eligible
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-500 text-red-700"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Not Eligible
                        </Badge>
                      )}
                      {check.responseData.priorAuthRequired && (
                        <Badge variant="secondary" className="ml-1">
                          Prior Auth
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {checkedAt.toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${isExpired ? "text-red-500" : "text-muted-foreground"}`}
                      >
                        {expiresAt.toLocaleDateString()}
                        {isExpired && " (expired)"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCheck(check)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={offset + limit >= total}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Eligibility Check Details</DialogTitle>
          </DialogHeader>
          {selectedCheck && (
            <EligibilityResult
              result={selectedCheck}
              clientId={clientId}
              onClose={() => setSelectedCheck(null)}
              showActions={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
