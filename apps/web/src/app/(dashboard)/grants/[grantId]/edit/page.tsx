"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { GrantForm } from "@/components/grants/grant-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { GrantStatus } from "@prisma/client";

interface Grant {
  id: string;
  name: string;
  funderName: string | null;
  grantNumber: string | null;
  description: string | null;
  startDate: string;
  endDate: string;
  status: GrantStatus;
  reportingFrequency: string | null;
}

export default function EditGrantPage({
  params,
}: {
  params: Promise<{ grantId: string }>;
}) {
  const { grantId } = use(params);
  const router = useRouter();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGrant = async () => {
      try {
        const response = await fetch(`/api/grants/${grantId}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push("/grants");
            return;
          }
          throw new Error("Failed to fetch grant");
        }
        const data = await response.json();
        setGrant(data.data);
      } catch (error) {
        console.error("Error fetching grant:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGrant();
  }, [grantId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!grant) {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/grants/${grantId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Grant</h1>
          <p className="text-muted-foreground">{grant.name}</p>
        </div>
      </div>

      {/* Form */}
      <GrantForm grant={grant} mode="edit" />
    </div>
  );
}
