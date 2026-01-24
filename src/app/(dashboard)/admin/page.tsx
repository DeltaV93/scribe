"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneNumbersTab } from "@/components/admin/phone-numbers-tab";
import { UsersTab } from "@/components/admin/users-tab";
import { TeamManagementTab } from "@/components/admin/team-management-tab";
import { SettingsTab } from "@/components/admin/settings-tab";
import { PhoneCostCard } from "@/components/admin/phone-cost-card";
import { Loader2, Shield } from "lucide-react";

interface PhoneStats {
  poolCount: number;
  assignedCount: number;
  totalCount: number;
  poolCost: number;
  assignedCost: number;
  totalMonthlyCost: number;
}

interface PhonePricing {
  monthlyCost: number;
  currency: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState<PhoneStats | null>(null);
  const [pricing, setPricing] = useState<PhonePricing | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    checkAuth();
    fetchStats();
    fetchPendingCount();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.status === 403) {
        router.push("/dashboard?error=unauthorized");
        return;
      }
      if (response.ok) {
        setIsAuthorized(true);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/phone-numbers/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data.stats);
        setPricing(data.data.pricing);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchPendingCount = async () => {
    try {
      const response = await fetch("/api/admin/phone-requests?countOnly=true");
      if (response.ok) {
        const data = await response.json();
        setPendingRequestCount(data.data.count);
      }
    } catch (error) {
      console.error("Failed to fetch pending count:", error);
    }
  };

  const refreshData = () => {
    fetchStats();
    fetchPendingCount();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage phone numbers, users, and organization settings
          </p>
        </div>
      </div>

      {/* Cost Summary */}
      {stats && <PhoneCostCard stats={stats} pricePerNumber={pricing?.monthlyCost} />}

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="phone-numbers">Phone Numbers</TabsTrigger>
          <TabsTrigger value="phone-requests" className="relative">
            Phone Requests
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {pendingRequestCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <TeamManagementTab />
        </TabsContent>

        <TabsContent value="phone-numbers">
          <PhoneNumbersTab onDataChange={refreshData} pricePerNumber={pricing?.monthlyCost} />
        </TabsContent>

        <TabsContent value="phone-requests">
          <UsersTab
            pendingRequestCount={pendingRequestCount}
            onDataChange={refreshData}
            pricePerNumber={pricing?.monthlyCost}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
