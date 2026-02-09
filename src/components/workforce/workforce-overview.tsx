"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlacementsList } from "./placements-list";
import { CredentialsList } from "./credentials-list";
import { Briefcase, Award, Loader2 } from "lucide-react";

interface WorkforceOverviewProps {
  clientId: string;
}

interface WorkforceStats {
  activePlacements: number;
  totalPlacements: number;
  activeCredentials: number;
  expiringCredentials: number;
}

export function WorkforceOverview({ clientId }: WorkforceOverviewProps) {
  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [placementsRes, credentialsRes] = await Promise.all([
          fetch(`/api/clients/${clientId}/placements`),
          fetch(`/api/clients/${clientId}/credentials`),
        ]);

        if (!placementsRes.ok || !credentialsRes.ok) {
          throw new Error("Failed to fetch workforce data");
        }

        const placementsData = await placementsRes.json();
        const credentialsData = await credentialsRes.json();

        const placements = placementsData.data || [];
        const credentials = credentialsData.data || [];

        setStats({
          activePlacements: placements.filter((p: { status: string }) => p.status === "ACTIVE").length,
          totalPlacements: placements.length,
          activeCredentials: credentials.filter(
            (c: { status: string }) => c.status === "ACTIVE" || c.status === "EXPIRING"
          ).length,
          expiringCredentials: credentials.filter(
            (c: { status: string }) => c.status === "EXPIRING"
          ).length,
        });
      } catch (error) {
        console.error("Error fetching workforce stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [clientId]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.activePlacements || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Placements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-secondary/10 p-2">
                <Briefcase className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalPlacements || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Placements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-green-500/10 p-2">
                <Award className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.activeCredentials || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active Credentials</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <Award className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.expiringCredentials || 0}
                </p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="placements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="placements" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Job Placements
          </TabsTrigger>
          <TabsTrigger value="credentials" className="gap-2">
            <Award className="h-4 w-4" />
            Credentials
          </TabsTrigger>
        </TabsList>
        <TabsContent value="placements">
          <PlacementsList clientId={clientId} />
        </TabsContent>
        <TabsContent value="credentials">
          <CredentialsList clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
