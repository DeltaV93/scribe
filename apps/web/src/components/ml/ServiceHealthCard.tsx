"use client";

/**
 * Service Health Card
 *
 * Displays the health status of ML services backend.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ServiceHealthCardProps {
  health: {
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
  };
  isLoading?: boolean;
}

export function ServiceHealthCard({ health, isLoading }: ServiceHealthCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
      case "connected":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    if (health.healthy) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Healthy
        </Badge>
      );
    }
    if (health.status === "degraded") {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Degraded
        </Badge>
      );
    }
    return <Badge variant="destructive">Unhealthy</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            ML Services Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          ML Services Status
        </CardTitle>
        <CardDescription>
          Backend infrastructure health status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Overall Status</span>
          {getStatusBadge()}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ML Services</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.services.ml_services.status)}
              <span className="capitalize">
                {health.services.ml_services.status}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Database</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.components.database)}
              <span className="capitalize">{health.components.database}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Redis Cache</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.components.redis)}
              <span className="capitalize">{health.components.redis}</span>
            </div>
          </div>
        </div>

        {health.error && (
          <p className="text-sm text-destructive">{health.error}</p>
        )}

        {health.timestamp && (
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
