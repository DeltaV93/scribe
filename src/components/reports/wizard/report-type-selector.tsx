"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, BarChart3, Users, Sparkles, Settings } from "lucide-react";

export interface ReportTypeOption {
  type: string;
  label: string;
  description: string;
}

interface ReportTypeSelectorProps {
  reportTypes: ReportTypeOption[];
  selectedType: string | null;
  onSelect: (type: string) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  HUD_APR: <Building2 className="h-8 w-8" />,
  DOL_WORKFORCE: <Users className="h-8 w-8" />,
  CALI_GRANTS: <FileText className="h-8 w-8" />,
  BOARD_REPORT: <BarChart3 className="h-8 w-8" />,
  IMPACT_REPORT: <Sparkles className="h-8 w-8" />,
  CUSTOM: <Settings className="h-8 w-8" />,
};

const BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  HUD_APR: { label: "Compliance", variant: "default" },
  DOL_WORKFORCE: { label: "Compliance", variant: "default" },
  CALI_GRANTS: { label: "Compliance", variant: "default" },
  BOARD_REPORT: { label: "Internal", variant: "secondary" },
  IMPACT_REPORT: { label: "External", variant: "outline" },
  CUSTOM: { label: "Flexible", variant: "outline" },
};

export function ReportTypeSelector({
  reportTypes,
  selectedType,
  onSelect,
}: ReportTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Report Type</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the type of report you want to create. Each type has specific questions and metric suggestions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((reportType) => (
          <Card
            key={reportType.type}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              selectedType === reportType.type
                ? "border-primary ring-2 ring-primary/20"
                : ""
            }`}
            onClick={() => onSelect(reportType.type)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="text-primary">
                  {ICONS[reportType.type] || <FileText className="h-8 w-8" />}
                </div>
                {BADGES[reportType.type] && (
                  <Badge variant={BADGES[reportType.type].variant}>
                    {BADGES[reportType.type].label}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg mt-3">{reportType.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">
                {reportType.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
