"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DeliverableStatusBadge,
  DeliverableProgress,
  DeliverableForm,
  ProgressHistory,
  LogProgressForm,
} from "@/components/grants";
import { DeliverableStatus, MetricType } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  TrendingUp,
  Target,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

interface Deliverable {
  id: string;
  name: string;
  description: string | null;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  status: DeliverableStatus;
  dueDate: string | null;
  autoReportOnComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

const metricTypeLabels: Record<MetricType, string> = {
  CLIENT_CONTACTS: "Client Contacts",
  CLIENTS_ENROLLED: "Clients Enrolled",
  PROGRAM_COMPLETIONS: "Program Completions",
  CLIENTS_HOUSED: "Clients Housed",
  SESSIONS_DELIVERED: "Sessions Delivered",
  FORM_SUBMISSIONS: "Form Submissions",
  CUSTOM: "Custom Metric",
};

export default function DeliverableDetailPage({
  params,
}: {
  params: Promise<{ grantId: string; deliverableId: string }>;
}) {
  const { grantId, deliverableId } = use(params);
  const router = useRouter();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showLogProgressForm, setShowLogProgressForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDeliverable = async () => {
    try {
      const response = await fetch(`/api/grants/${grantId}/deliverables/${deliverableId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push(`/grants/${grantId}`);
          return;
        }
        throw new Error("Failed to fetch deliverable");
      }
      const data = await response.json();
      setDeliverable(data.data);
    } catch (error) {
      console.error("Error fetching deliverable:", error);
      toast.error("Failed to load deliverable");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliverable();
  }, [grantId, deliverableId, refreshKey]);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/grants/${grantId}/deliverables/${deliverableId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete deliverable");
      }

      toast.success("Deliverable deleted successfully");
      router.push(`/grants/${grantId}`);
    } catch (error) {
      console.error("Error deleting deliverable:", error);
      toast.error("Failed to delete deliverable");
    }
    setShowDeleteDialog(false);
  };

  const handleFormSuccess = () => {
    setRefreshKey((k) => k + 1);
    setShowEditForm(false);
  };

  const handleLogProgressSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!deliverable) {
    return null;
  }

  const percentage =
    deliverable.targetValue > 0
      ? Math.round((deliverable.currentValue / deliverable.targetValue) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/grants/${grantId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{deliverable.name}</h1>
              <DeliverableStatusBadge status={deliverable.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              {metricTypeLabels[deliverable.metricType]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowLogProgressForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Log Progress
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Deliverable
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Deliverable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold">{deliverable.currentValue}</p>
                  <p className="text-muted-foreground">of {deliverable.targetValue} target</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-primary">{percentage}%</p>
                  <p className="text-muted-foreground">complete</p>
                </div>
              </div>
              <DeliverableProgress
                currentValue={deliverable.currentValue}
                targetValue={deliverable.targetValue}
                size="lg"
                showLabel={false}
              />
            </CardContent>
          </Card>

          {/* Progress History */}
          <ProgressHistory
            key={refreshKey}
            grantId={grantId}
            deliverableId={deliverableId}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Metric Type</p>
                  <p className="text-sm text-muted-foreground">
                    {metricTypeLabels[deliverable.metricType]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Target Value</p>
                  <p className="text-sm text-muted-foreground">
                    {deliverable.targetValue.toLocaleString()}
                  </p>
                </div>
              </div>

              {deliverable.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Due Date</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(deliverable.dueDate), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}

              {deliverable.description && (
                <div>
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deliverable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the deliverable and all its progress history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeliverableForm
        grantId={grantId}
        deliverable={deliverable}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onSuccess={handleFormSuccess}
      />

      <LogProgressForm
        grantId={grantId}
        deliverableId={deliverableId}
        deliverableName={deliverable.name}
        currentValue={deliverable.currentValue}
        targetValue={deliverable.targetValue}
        open={showLogProgressForm}
        onOpenChange={setShowLogProgressForm}
        onSuccess={handleLogProgressSuccess}
      />
    </div>
  );
}
