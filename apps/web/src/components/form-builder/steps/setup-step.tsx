"use client";

import { useAtom, useSetAtom } from "jotai";
import { formBuilderAtom, updateFormAtom } from "@/lib/form-builder/store";
import { FormType, type FormSettings } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formTypeOptions = [
  {
    value: FormType.INTAKE,
    label: "Intake Form",
    description: "Initial client registration and assessment",
  },
  {
    value: FormType.FOLLOWUP,
    label: "Follow-up Form",
    description: "Progress tracking and check-ins",
  },
  {
    value: FormType.REFERRAL,
    label: "Referral Form",
    description: "Partner agency referrals",
  },
  {
    value: FormType.ASSESSMENT,
    label: "Assessment Form",
    description: "Detailed evaluations and screenings",
  },
  {
    value: FormType.CUSTOM,
    label: "Custom Form",
    description: "Other form types",
  },
];

export function SetupStep() {
  const [state] = useAtom(formBuilderAtom);
  const updateForm = useSetAtom(updateFormAtom);

  const form = state.form;
  const settings = form.settings as FormSettings;

  const handleSettingsChange = (updates: Partial<FormSettings>) => {
    updateForm({
      settings: {
        ...settings,
        ...updates,
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Give your form a name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="form-name" required>
              Form Name
            </Label>
            <Input
              id="form-name"
              value={form.name || ""}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="e.g., Client Intake Form"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-description">Description</Label>
            <Textarea
              id="form-description"
              value={form.description || ""}
              onChange={(e) => updateForm({ description: e.target.value || null })}
              placeholder="Brief description of this form's purpose"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-type">Form Type</Label>
            <Select
              value={form.type || FormType.INTAKE}
              onValueChange={(value: FormType) => updateForm({ type: value })}
            >
              <SelectTrigger id="form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Form Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Form Settings</CardTitle>
          <CardDescription>
            Configure how this form behaves
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="partial-saves">Allow Partial Saves</Label>
              <p className="text-xs text-muted-foreground">
                Users can save progress and return later
              </p>
            </div>
            <Switch
              id="partial-saves"
              checked={settings?.allowPartialSaves ?? true}
              onCheckedChange={(checked) =>
                handleSettingsChange({ allowPartialSaves: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="supervisor-review">Require Supervisor Review</Label>
              <p className="text-xs text-muted-foreground">
                Submissions need supervisor approval
              </p>
            </div>
            <Switch
              id="supervisor-review"
              checked={settings?.requireSupervisorReview ?? false}
              onCheckedChange={(checked) =>
                handleSettingsChange({ requireSupervisorReview: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-archive">Auto-Archive After (days)</Label>
            <Select
              value={settings?.autoArchiveDays?.toString() || "none"}
              onValueChange={(value) =>
                handleSettingsChange({
                  autoArchiveDays: value === "none" ? null : parseInt(value),
                })
              }
            >
              <SelectTrigger id="auto-archive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Automatically archive form after period of inactivity
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activity Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Tracking</CardTitle>
          <CardDescription>
            What counts as activity for this form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Track Submissions</Label>
              <p className="text-xs text-muted-foreground">
                New form submissions reset inactivity
              </p>
            </div>
            <Switch
              checked={settings?.activityTriggers?.includes("submissions") ?? true}
              onCheckedChange={(checked) => {
                const triggers = settings?.activityTriggers || [];
                handleSettingsChange({
                  activityTriggers: checked
                    ? [...triggers, "submissions"]
                    : triggers.filter((t) => t !== "submissions"),
                });
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Track Edits</Label>
              <p className="text-xs text-muted-foreground">
                Editing submissions resets inactivity
              </p>
            </div>
            <Switch
              checked={settings?.activityTriggers?.includes("edits") ?? false}
              onCheckedChange={(checked) => {
                const triggers = settings?.activityTriggers || [];
                handleSettingsChange({
                  activityTriggers: checked
                    ? [...triggers, "edits"]
                    : triggers.filter((t) => t !== "edits"),
                });
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Track Views</Label>
              <p className="text-xs text-muted-foreground">
                Viewing submissions resets inactivity
              </p>
            </div>
            <Switch
              checked={settings?.activityTriggers?.includes("views") ?? false}
              onCheckedChange={(checked) => {
                const triggers = settings?.activityTriggers || [];
                handleSettingsChange({
                  activityTriggers: checked
                    ? [...triggers, "views"]
                    : triggers.filter((t) => t !== "views"),
                });
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
