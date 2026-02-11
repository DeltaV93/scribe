"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalFormData } from "./goal-wizard";
import { GoalType } from "@prisma/client";
import { Loader2, Target, TrendingUp, FileText } from "lucide-react";

interface GoalMetricsStepProps {
  formData: GoalFormData;
  onChange: (updates: Partial<GoalFormData>) => void;
}

interface Grant {
  id: string;
  name: string;
  status: string;
}

interface Kpi {
  id: string;
  name: string;
  metricType: string;
  targetValue: number;
}

interface Objective {
  id: string;
  title: string;
  status: string;
}

export function GoalMetricsStep({ formData, onChange }: GoalMetricsStepProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const [grantsRes, kpisRes] = await Promise.all([
          fetch("/api/grants?limit=50"),
          fetch("/api/kpis?limit=50"),
        ]);

        if (grantsRes.ok) {
          const data = await grantsRes.json();
          setGrants(data.data || []);
        }

        if (kpisRes.ok) {
          const data = await kpisRes.json();
          setKpis(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, []);

  const toggleGrant = (grantId: string) => {
    const newGrantIds = formData.grantIds.includes(grantId)
      ? formData.grantIds.filter((id) => id !== grantId)
      : [...formData.grantIds, grantId];
    onChange({ grantIds: newGrantIds });
  };

  const toggleKpi = (kpiId: string) => {
    const newKpiIds = formData.kpiIds.includes(kpiId)
      ? formData.kpiIds.filter((id) => id !== kpiId)
      : [...formData.kpiIds, kpiId];
    onChange({ kpiIds: newKpiIds });
  };

  const toggleObjective = (objectiveId: string) => {
    const newObjectiveIds = formData.objectiveIds.includes(objectiveId)
      ? formData.objectiveIds.filter((id) => id !== objectiveId)
      : [...formData.objectiveIds, objectiveId];
    onChange({ objectiveIds: newObjectiveIds });
  };

  // Determine default tab based on goal type
  const getDefaultTab = () => {
    switch (formData.type) {
      case GoalType.GRANT:
        return "grants";
      case GoalType.KPI:
        return "kpis";
      case GoalType.OKR:
        return "objectives";
      default:
        return "grants";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Link existing grants, KPIs, or objectives to track progress toward this goal.
        This step is optional - you can add items later.
      </p>

      <Tabs defaultValue={getDefaultTab()}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="grants" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Grants ({formData.grantIds.length})
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            KPIs ({formData.kpiIds.length})
          </TabsTrigger>
          <TabsTrigger value="objectives" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            OKRs ({formData.objectiveIds.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="mt-4">
          {grants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No grants available</p>
              <p className="text-sm">Create grants first to link them here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {grants.map((grant) => (
                <Card
                  key={grant.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleGrant(grant.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Checkbox
                      checked={formData.grantIds.includes(grant.id)}
                      onCheckedChange={() => toggleGrant(grant.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{grant.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {grant.status.toLowerCase()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kpis" className="mt-4">
          {kpis.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No KPIs available</p>
              <p className="text-sm">Create KPIs first to link them here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {kpis.map((kpi) => (
                <Card
                  key={kpi.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleKpi(kpi.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Checkbox
                      checked={formData.kpiIds.includes(kpi.id)}
                      onCheckedChange={() => toggleKpi(kpi.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{kpi.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {kpi.targetValue}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="objectives" className="mt-4">
          {objectives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No objectives available</p>
              <p className="text-sm">Create OKRs first to link them here.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {objectives.map((objective) => (
                <Card
                  key={objective.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleObjective(objective.id)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Checkbox
                      checked={formData.objectiveIds.includes(objective.id)}
                      onCheckedChange={() => toggleObjective(objective.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{objective.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {objective.status.toLowerCase()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
