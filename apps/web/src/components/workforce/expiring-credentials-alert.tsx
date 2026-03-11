"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, Loader2, Award } from "lucide-react";
import Link from "next/link";

interface ExpiringCredential {
  credential: {
    id: string;
    clientId: string;
    name: string;
    expiryDate: string;
    daysUntilExpiry: number;
  };
  daysUntilExpiry: number;
  clientName: string;
}

interface ExpiringCredentialsAlertProps {
  daysUntilExpiry?: number;
  limit?: number;
}

export function ExpiringCredentialsAlert({
  daysUntilExpiry = 30,
  limit = 5,
}: ExpiringCredentialsAlertProps) {
  const [credentials, setCredentials] = useState<ExpiringCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExpiringCredentials() {
      try {
        const response = await fetch(`/api/credentials/expiring?days=${daysUntilExpiry}`);
        if (!response.ok) {
          throw new Error("Failed to fetch expiring credentials");
        }
        const data = await response.json();
        setCredentials((data.data?.expiringCredentials || []).slice(0, limit));
      } catch (err) {
        console.error("Error fetching expiring credentials:", err);
        setError("Failed to load expiring credentials");
      } finally {
        setIsLoading(false);
      }
    }

    fetchExpiringCredentials();
  }, [daysUntilExpiry, limit]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (credentials.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            Expiring Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4 text-sm text-muted-foreground">
          No credentials expiring in the next {daysUntilExpiry} days.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Expiring Credentials
            <Badge variant="secondary" className="ml-2">
              {credentials.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/credentials/expiring">
              View all
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {credentials.map((item) => (
            <div
              key={item.credential.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{item.credential.name}</p>
                <p className="text-xs text-muted-foreground truncate">{item.clientName}</p>
              </div>
              <Badge
                variant={item.daysUntilExpiry <= 7 ? "destructive" : "outline"}
                className={
                  item.daysUntilExpiry <= 7
                    ? ""
                    : item.daysUntilExpiry <= 14
                      ? "border-yellow-500 text-yellow-600"
                      : ""
                }
              >
                {item.daysUntilExpiry} days
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
