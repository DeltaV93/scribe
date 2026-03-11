"use client";

/**
 * Compliance Status Card
 *
 * Displays the active compliance frameworks and their status.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, CheckCircle, Clock } from "lucide-react";

interface ComplianceStatusCardProps {
  status: {
    frameworks: string[];
    overrides_count: number;
    last_audit_at: string | null;
  };
  isLoading?: boolean;
}

// Framework display names
const FRAMEWORK_NAMES: Record<string, string> = {
  hipaa: "HIPAA",
  soc2: "SOC 2",
  gdpr: "GDPR",
  ccpa: "CCPA",
  ferpa: "FERPA",
  "42cfr": "42 CFR Part 2",
};

export function ComplianceStatusCard({ status, isLoading }: ComplianceStatusCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const getFrameworkDisplayName = (framework: string) => {
    return FRAMEWORK_NAMES[framework.toLowerCase()] || framework.toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Compliance Frameworks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="h-6 w-16 bg-muted rounded" />
            </div>
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Compliance Frameworks
        </CardTitle>
        <CardDescription>
          Active regulatory compliance frameworks for ML operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.frameworks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No compliance frameworks configured
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {status.frameworks.map((framework) => (
              <Badge
                key={framework}
                variant="secondary"
                className="gap-1 bg-green-100 text-green-800"
              >
                <CheckCircle className="h-3 w-3" />
                {getFrameworkDisplayName(framework)}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-sm text-muted-foreground">Policy Overrides</p>
            <p className="text-lg font-semibold">
              {status.overrides_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last Audit
            </p>
            <p className="text-lg font-semibold">
              {formatDate(status.last_audit_at)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
