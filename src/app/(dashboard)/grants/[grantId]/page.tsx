"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  GrantStatusBadge,
  DeliverableCard,
  DeliverableProgress,
  DeliverableForm,
} from "@/components/grants";
import { GrantStatus, DeliverableStatus, MetricType } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  MoreVertical,
  Pencil,
  Archive,
  Plus,
  Loader2,
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

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
  stats?: {
    totalDeliverables: number;
    completedDeliverables: number;
    atRiskDeliverables: number;
    overdueDeliverables: number;
    overallProgress: number;
  };
}

interface Deliverable {
  id: string;
  name: string;
  description: string | null;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  status: DeliverableStatus;
  dueDate: string | null;
}

export default function GrantDetailPage({
  params,
}: {
  params: Promise<{ grantId: string }>;
}) {
  const { grantId } = use(params);
  const router = useRouter();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<Deliverable | null>(null);

  const fetchGrant = async () => {
    try {
      const response = await fetch(`/api/grants/${grantId}?includeStats=true`);
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
      toast.error("Failed to load grant");
    }
  };

  const fetchDeliverables = async () => {
    try {
      const response = await fetch(`/api/grants/${grantId}/deliverables`);
      if (response.ok) {
        const data = await response.json();
        setDeliverables(data.data);
      }
    } catch (error) {
      console.error("Error fetching deliverables:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchGrant(), fetchDeliverables()]);
      setIsLoading(false);
    };
    loadData();
  }, [grantId]);

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/grants/${grantId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to archive grant");
      }

      toast.success("Grant archived successfully");
      router.push("/grants");
    } catch (error) {
      console.error("Error archiving grant:", error);
      toast.error("Failed to archive grant");
    }
    setShowArchiveDialog(false);
  };

  const handleDeliverableSuccess = () => {
    fetchDeliverables();
    fetchGrant(); // Refresh stats
    setEditingDeliverable(null);
  };

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

  const daysRemaining = differenceInDays(new Date(grant.endDate), new Date());
  const totalProgress = grant.stats
    ? deliverables.reduce((sum, d) => sum + d.currentValue, 0)
    : 0;
  const totalTarget = deliverables.reduce((sum, d) => sum + d.targetValue, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/grants">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{grant.name}</h1>
              <GrantStatusBadge status={grant.status} />
            </div>
            {grant.grantNumber && (
              <p className="text-muted-foreground mt-1">#{grant.grantNumber}</p>
            )}
            {grant.funderName && (
              <p className="text-muted-foreground">Funder: {grant.funderName}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/grants/${grantId}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Grant
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowArchiveDialog(true)}
              className="text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive Grant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0}%
            </div>
            <DeliverableProgress
              currentValue={totalProgress}
              targetValue={totalTarget}
              size="sm"
              showLabel={false}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deliverables</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {grant.stats?.completedDeliverables || 0} / {grant.stats?.totalDeliverables || 0}
            </div>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {daysRemaining > 0 ? daysRemaining : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {daysRemaining > 0 ? "days left" : "expired"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {(grant.stats?.atRiskDeliverables || 0) + (grant.stats?.overdueDeliverables || 0)}
            </div>
            <p className="text-xs text-muted-foreground">deliverables need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Grant Details & Deliverables */}
      <Tabs defaultValue="deliverables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="deliverables" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Grant Deliverables</h2>
            <Button onClick={() => setShowDeliverableForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Deliverable
            </Button>
          </div>

          {deliverables.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No deliverables yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mt-1">
                  Add deliverables to track progress toward your grant goals.
                </p>
                <Button className="mt-4" onClick={() => setShowDeliverableForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Deliverable
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {deliverables.map((deliverable) => (
                <DeliverableCard
                  key={deliverable.id}
                  deliverable={deliverable}
                  onClick={() => router.push(`/grants/${grantId}/deliverables/${deliverable.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Grant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Grant Period</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(grant.startDate), "MMM d, yyyy")} -{" "}
                      {format(new Date(grant.endDate), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Reporting Frequency
                  </p>
                  <p className="mt-1 capitalize">
                    {grant.reportingFrequency || "Not specified"}
                  </p>
                </div>
              </div>

              {grant.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{grant.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this grant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the grant and all its deliverables. You can restore it
              later from the archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeliverableForm
        grantId={grantId}
        deliverable={editingDeliverable || undefined}
        open={showDeliverableForm}
        onOpenChange={(open) => {
          setShowDeliverableForm(open);
          if (!open) setEditingDeliverable(null);
        }}
        onSuccess={handleDeliverableSuccess}
      />
    </div>
  );
}
