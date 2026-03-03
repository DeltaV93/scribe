"use client";

/**
 * ML Settings Content
 *
 * Client component that fetches and displays ML services status.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  ServiceHealthCard,
  PrivacyBudgetCard,
  ComplianceStatusCard,
} from "@/components/ml";

interface HealthData {
  healthy: boolean;
  status: string;
  services: {
    ml_services: {
      status: string;
      error?: string;
    };
  };
  components: {
    database: string;
    redis: string;
  };
  timestamp?: string;
  error?: string;
}

interface PrivacyBudgetData {
  epsilon_budget: number;
  epsilon_consumed: number;
  epsilon_remaining: number;
  budget_reset_at: string | null;
  is_exhausted: boolean;
}

interface ComplianceData {
  frameworks: string[];
  overrides_count: number;
  last_audit_at: string | null;
}

export function MLSettingsContent() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyBudgetData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [healthRes, privacyRes, complianceRes] = await Promise.all([
        fetch("/api/ml/health"),
        fetch("/api/ml/privacy"),
        fetch("/api/ml/compliance"),
      ]);

      // Process health data
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data.data);
      } else {
        setHealth({
          healthy: false,
          status: "error",
          services: { ml_services: { status: "error" } },
          components: { database: "unknown", redis: "unknown" },
          error: "Failed to fetch health status",
        });
      }

      // Process privacy data
      if (privacyRes.ok) {
        const data = await privacyRes.json();
        setPrivacy(data.data);
      }

      // Process compliance data
      if (complianceRes.ok) {
        const data = await complianceRes.json();
        setCompliance(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch ML settings data:", error);
      toast.error("Failed to load ML services status");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ServiceHealthCard
        health={health || {
          healthy: false,
          status: "unknown",
          services: { ml_services: { status: "unknown" } },
          components: { database: "unknown", redis: "unknown" },
        }}
      />

      <PrivacyBudgetCard
        budget={privacy || {
          epsilon_budget: 5.0,
          epsilon_consumed: 0.0,
          epsilon_remaining: 5.0,
          budget_reset_at: null,
          is_exhausted: false,
        }}
      />

      <ComplianceStatusCard
        status={compliance || {
          frameworks: [],
          overrides_count: 0,
          last_audit_at: null,
        }}
      />
    </div>
  );
}
