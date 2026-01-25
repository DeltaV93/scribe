"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneForwarded, DollarSign } from "lucide-react";

interface PhoneStats {
  poolCount: number;
  assignedCount: number;
  totalCount: number;
  poolCost: number;
  assignedCost: number;
  totalMonthlyCost: number;
}

interface PhoneCostCardProps {
  stats: PhoneStats;
  pricePerNumber?: number;
}

export function PhoneCostCard({ stats, pricePerNumber = 5.0 }: PhoneCostCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pool Numbers</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.poolCount}</div>
          <p className="text-xs text-muted-foreground">
            ${stats.poolCost.toFixed(2)}/month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Assigned Numbers</CardTitle>
          <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.assignedCount}</div>
          <p className="text-xs text-muted-foreground">
            ${stats.assignedCost.toFixed(2)}/month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Monthly Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${stats.totalMonthlyCost.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.totalCount} numbers @ ${pricePerNumber.toFixed(2)}/each
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
