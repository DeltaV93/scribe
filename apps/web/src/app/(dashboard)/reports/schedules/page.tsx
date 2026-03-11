"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Settings,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ScheduleSummary {
  id: string;
  templateId: string;
  templateName: string;
  templateType: string;
  enabled: boolean;
  cronExpression: string;
  cronDescription: string;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
  failureCount: number;
  distributionEnabled: boolean;
  recipientCount: number;
}

interface SchedulePreset {
  id: string;
  label: string;
  cronExpression: string;
  description: string;
}

interface TimezoneOption {
  value: string;
  label: string;
}

interface Recipient {
  email: string;
  name?: string;
  type: "to" | "cc" | "bcc";
}

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [presets, setPresets] = useState<SchedulePreset[]>([]);
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSummary | null>(
    null
  );
  const [editForm, setEditForm] = useState({
    enabled: true,
    cronExpression: "",
    timezone: "America/Los_Angeles",
    distributionEnabled: false,
    recipients: [] as Recipient[],
    subject: "",
    message: "",
    attachPdf: true,
  });

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [schedulesRes, optionsRes] = await Promise.all([
          fetch("/api/reports/schedules"),
          fetch("/api/reports/schedules?preset=options"),
        ]);

        if (schedulesRes.ok) {
          const data = await schedulesRes.json();
          setSchedules(data.data || []);
        }

        if (optionsRes.ok) {
          const data = await optionsRes.json();
          setPresets(data.data?.schedulePresets || []);
          setTimezones(data.data?.timezoneOptions || []);
        }
      } catch (error) {
        console.error("Error loading schedules:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const openEditDialog = (schedule: ScheduleSummary) => {
    setEditingSchedule(schedule);
    setEditForm({
      enabled: schedule.enabled,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      distributionEnabled: schedule.distributionEnabled,
      recipients: [],
      subject: "",
      message: "",
      attachPdf: true,
    });
    setEditDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;

    setSaving(true);
    try {
      const response = await fetch("/api/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: editingSchedule.templateId,
          enabled: editForm.enabled,
          cronExpression: editForm.cronExpression,
          timezone: editForm.timezone,
          distributionSettings: editForm.distributionEnabled
            ? {
                enabled: true,
                recipients: editForm.recipients,
                subject: editForm.subject || undefined,
                message: editForm.message || undefined,
                attachPdf: editForm.attachPdf,
              }
            : undefined,
        }),
      });

      if (response.ok) {
        // Refresh schedules list
        const schedulesRes = await fetch("/api/reports/schedules");
        if (schedulesRes.ok) {
          const data = await schedulesRes.json();
          setSchedules(data.data || []);
        }
        setEditDialogOpen(false);
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to save schedule");
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    setEditForm((prev) => ({
      ...prev,
      recipients: [...prev.recipients, { email: "", type: "to" }],
    }));
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      ),
    }));
  };

  const removeRecipient = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateStr));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scheduled Reports</h1>
          <p className="text-muted-foreground">
            Manage automated report generation schedules
          </p>
        </div>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg mb-2">No scheduled reports</CardTitle>
            <CardDescription className="text-center mb-4">
              Schedule reports to be automatically generated on a recurring basis.
            </CardDescription>
            <Link href="/reports/templates">
              <Button variant="outline">
                Manage Report Templates
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        schedule.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{schedule.templateName}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {schedule.cronDescription}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {schedule.enabled ? (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}

                      {schedule.failureCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {schedule.failureCount} failures
                        </Badge>
                      )}

                      {schedule.distributionEnabled && (
                        <Badge variant="outline" className="gap-1">
                          <Mail className="h-3 w-3" />
                          {schedule.recipientCount}
                        </Badge>
                      )}
                    </div>

                    {/* Next Run */}
                    {schedule.nextRunAt && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Next run
                        </div>
                        <div className="text-sm font-medium">
                          {formatDate(schedule.nextRunAt)}
                        </div>
                      </div>
                    )}

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(schedule)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Schedule</DialogTitle>
            <DialogDescription>
              {editingSchedule?.templateName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, reports will not be automatically generated
                </p>
              </div>
              <Switch
                checked={editForm.enabled}
                onCheckedChange={(checked) =>
                  setEditForm((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={editForm.cronExpression}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, cronExpression: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem
                      key={preset.id}
                      value={preset.cronExpression}
                    >
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={editForm.timezone}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Distribution */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label>Email Distribution</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send reports via email when generated
                  </p>
                </div>
                <Switch
                  checked={editForm.distributionEnabled}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({
                      ...prev,
                      distributionEnabled: checked,
                    }))
                  }
                />
              </div>

              {editForm.distributionEnabled && (
                <div className="space-y-4 pl-4 border-l-2">
                  {/* Recipients */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Recipients</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addRecipient}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>

                    {editForm.recipients.map((recipient, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={recipient.type}
                          onValueChange={(value) =>
                            updateRecipient(index, "type", value)
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to">To</SelectItem>
                            <SelectItem value="cc">CC</SelectItem>
                            <SelectItem value="bcc">BCC</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={recipient.email}
                          onChange={(e) =>
                            updateRecipient(index, "email", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecipient(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {editForm.recipients.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No recipients added yet
                      </p>
                    )}
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label>Subject (optional)</Label>
                    <Input
                      placeholder="Leave blank for default subject"
                      value={editForm.subject}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          subject: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label>Message (optional)</Label>
                    <Textarea
                      placeholder="Add a custom message to include in the email"
                      value={editForm.message}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  {/* Attach PDF */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="attachPdf"
                      checked={editForm.attachPdf}
                      onCheckedChange={(checked) =>
                        setEditForm((prev) => ({
                          ...prev,
                          attachPdf: checked,
                        }))
                      }
                    />
                    <Label htmlFor="attachPdf">Attach PDF to email</Label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
