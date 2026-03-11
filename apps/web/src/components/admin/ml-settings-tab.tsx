"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Eye, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type {
  OrgProfile,
  Industry,
  CompanyType,
  ModelTier,
  IndustryDefault,
  CustomSignals,
} from "@/lib/ml-services/types";
import { CustomSignalsEditor } from "./custom-signals-editor";
import { MatchingRulesEditor } from "./matching-rules-editor";
import { ModelTierModal } from "./model-tier-modal";

const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "nonprofit", label: "Nonprofit / Social Services" },
  { value: "healthcare", label: "Healthcare / FQHC" },
  { value: "tech", label: "Technology / SaaS" },
  { value: "legal", label: "Legal / Law Firm" },
  { value: "sales", label: "Sales / Business Development" },
  { value: "education", label: "Education / K-12 / Higher Ed" },
  { value: "government", label: "Government" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "startup", label: "Startup" },
  { value: "enterprise", label: "Enterprise" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government" },
  { value: "agency", label: "Agency" },
  { value: "consulting", label: "Consulting" },
];

const COMPLIANCE_FRAMEWORKS = [
  { value: "HIPAA", label: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  { value: "SOC2", label: "SOC 2", description: "Service Organization Control 2" },
  { value: "GDPR", label: "GDPR", description: "General Data Protection Regulation" },
  { value: "FERPA", label: "FERPA", description: "Family Educational Rights and Privacy Act" },
  { value: "WIOA", label: "WIOA", description: "Workforce Innovation and Opportunity Act" },
  { value: "42CFR", label: "42 CFR Part 2", description: "Substance Abuse Treatment Records" },
];

interface MLSettingsTabProps {
  onDataChange?: () => void;
}

export function MLSettingsTab({ onDataChange }: MLSettingsTabProps) {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [industryDefaults, setIndustryDefaults] = useState<IndustryDefault[]>([]);
  const [previewingIndustry, setPreviewingIndustry] = useState<IndustryDefault | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [pendingTierChange, setPendingTierChange] = useState<ModelTier | null>(null);

  // Form state
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [secondaryIndustry, setSecondaryIndustry] = useState<Industry | null>(null);
  const [companyType, setCompanyType] = useState<CompanyType | null>(null);
  const [teamRoles, setTeamRoles] = useState<string[]>([]);
  const [modelTier, setModelTier] = useState<ModelTier>("shared");
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [customSignals, setCustomSignals] = useState<CustomSignals>({
    keywords: [],
    patterns: [],
    weights: {},
  });
  const [matchingRules, setMatchingRules] = useState<{
    overrides: Record<string, unknown>[];
    weights: Record<string, number>;
    disabled_rules: string[];
  }>({
    overrides: [],
    weights: {},
    disabled_rules: [],
  });
  const [complianceFrameworks, setComplianceFrameworks] = useState<string[]>([]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/ml/org/profile");
      if (response.ok) {
        const data = await response.json();
        const p = data.data as OrgProfile;
        setProfile(p);
        setIndustry(p.industry);
        setSecondaryIndustry(p.secondary_industry);
        setCompanyType(p.company_type);
        setTeamRoles(p.team_roles || []);
        setModelTier(p.model_tier);
        setDataSharingConsent(p.data_sharing_consent);
        setCustomSignals(p.custom_signals || { keywords: [], patterns: [], weights: {} });
        setMatchingRules(p.matching_rules || { overrides: [], weights: {}, disabled_rules: [] });
        setComplianceFrameworks(p.compliance_frameworks || []);
      }
    } catch (error) {
      console.error("Failed to fetch ML profile:", error);
    }
  }, []);

  const fetchIndustryDefaults = useCallback(async () => {
    try {
      const response = await fetch("/api/ml/industries");
      if (response.ok) {
        const data = await response.json();
        setIndustryDefaults(data.industries || []);
      }
    } catch (error) {
      console.error("Failed to fetch industry defaults:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchProfile(), fetchIndustryDefaults()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchIndustryDefaults]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/ml/org/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          secondary_industry: secondaryIndustry,
          company_type: companyType,
          team_roles: teamRoles,
          model_tier: modelTier,
          data_sharing_consent: dataSharingConsent,
          custom_signals: customSignals,
          matching_rules: matchingRules,
          compliance_frameworks: complianceFrameworks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to save settings");
      }

      toast.success("ML settings saved");
      await fetchProfile();
      onDataChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewIndustry = () => {
    if (!industry) return;
    const defaults = industryDefaults.find((d) => d.id === industry);
    setPreviewingIndustry(defaults || null);
  };

  const handleApplyDefaults = () => {
    if (!previewingIndustry) return;

    // Merge custom signals (add defaults, don't replace existing)
    const mergedKeywords = [...new Set([...customSignals.keywords, ...previewingIndustry.custom_signals.keywords])];
    const mergedPatterns = [...new Set([...customSignals.patterns, ...previewingIndustry.custom_signals.patterns])];
    const mergedWeights = { ...previewingIndustry.custom_signals.weights, ...customSignals.weights };

    setCustomSignals({
      keywords: mergedKeywords,
      patterns: mergedPatterns,
      weights: mergedWeights,
    });

    // Merge team roles
    setTeamRoles([...new Set([...teamRoles, ...previewingIndustry.team_roles])]);

    // Merge suggested compliance
    setComplianceFrameworks([...new Set([...complianceFrameworks, ...previewingIndustry.suggested_compliance])]);

    toast.success("Industry defaults applied");
    setPreviewingIndustry(null);
  };

  const handleTierChange = (newTier: ModelTier) => {
    if (newTier !== modelTier) {
      setPendingTierChange(newTier);
      setShowTierModal(true);
    }
  };

  const confirmTierChange = () => {
    if (pendingTierChange) {
      setModelTier(pendingTierChange);
      if (pendingTierChange === "private") {
        setDataSharingConsent(false);
      }
    }
    setShowTierModal(false);
    setPendingTierChange(null);
  };

  const handleComplianceToggle = (framework: string, checked: boolean) => {
    if (checked) {
      setComplianceFrameworks([...complianceFrameworks, framework]);
    } else {
      setComplianceFrameworks(complianceFrameworks.filter((f) => f !== framework));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Industry Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Industry Classification</CardTitle>
          <CardDescription>
            Select your industry to get relevant defaults for signals, team roles, and compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Primary Industry</Label>
              <Select
                value={industry || ""}
                onValueChange={(v) => setIndustry(v as Industry)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-industry">Secondary Industry (Optional)</Label>
              <Select
                value={secondaryIndustry || "none"}
                onValueChange={(v) => setSecondaryIndustry(v === "none" ? null : (v as Industry))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {INDUSTRIES.filter((ind) => ind.value !== industry).map((ind) => (
                    <SelectItem key={ind.value} value={ind.value}>
                      {ind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                For hybrid organizations (e.g., FQHC, Legal Aid)
              </p>
            </div>
          </div>

          {industry && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviewIndustry}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Defaults
              </Button>
            </div>
          )}

          {/* Preview Panel */}
          {previewingIndustry && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{previewingIndustry.name} Defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Suggested Compliance</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewingIndustry.suggested_compliance.map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Team Roles</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewingIndustry.team_roles.slice(0, 5).map((r) => (
                      <Badge key={r} variant="outline">{r.replace(/_/g, " ")}</Badge>
                    ))}
                    {previewingIndustry.team_roles.length > 5 && (
                      <Badge variant="outline">+{previewingIndustry.team_roles.length - 5} more</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Keywords (sample)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewingIndustry.custom_signals.keywords.slice(0, 8).map((k) => (
                      <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                    ))}
                    {previewingIndustry.custom_signals.keywords.length > 8 && (
                      <Badge variant="outline" className="text-xs">+{previewingIndustry.custom_signals.keywords.length - 8} more</Badge>
                    )}
                  </div>
                </div>
                <Button onClick={handleApplyDefaults} className="mt-2">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Apply Defaults
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Company Type */}
      <Card>
        <CardHeader>
          <CardTitle>Company Type</CardTitle>
          <CardDescription>
            Your organization structure affects default configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select
              value={companyType || ""}
              onValueChange={(v) => setCompanyType(v as CompanyType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company type" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Model Tier */}
      <Card>
        <CardHeader>
          <CardTitle>Model Training Tier</CardTitle>
          <CardDescription>
            Choose how your organization's data contributes to AI model training
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={`p-4 border rounded-lg cursor-pointer ${
                modelTier === "shared" ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => handleTierChange("shared")}
            >
              <div className="font-medium">Shared Model</div>
              <p className="text-sm text-muted-foreground mt-1">
                Your anonymized data helps improve global models. You benefit from
                improvements across the platform.
              </p>
            </div>
            <div
              className={`p-4 border rounded-lg cursor-pointer ${
                modelTier === "private" ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => handleTierChange("private")}
            >
              <div className="font-medium">Private Model</div>
              <p className="text-sm text-muted-foreground mt-1">
                Your data is only used for your organization's models. Maximum data
                isolation.
              </p>
            </div>
          </div>

          {modelTier === "shared" && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <Checkbox
                id="consent"
                checked={dataSharingConsent}
                onCheckedChange={(checked) => setDataSharingConsent(checked as boolean)}
              />
              <div>
                <Label htmlFor="consent" className="cursor-pointer">
                  I consent to contributing anonymized data to global model training
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Data is anonymized using differential privacy techniques before contributing.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Requirements</CardTitle>
          <CardDescription>
            Select the compliance frameworks your organization must adhere to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {COMPLIANCE_FRAMEWORKS.map((framework) => (
              <div key={framework.value} className="flex items-start gap-2">
                <Checkbox
                  id={`compliance-${framework.value}`}
                  checked={complianceFrameworks.includes(framework.value)}
                  onCheckedChange={(checked) =>
                    handleComplianceToggle(framework.value, checked as boolean)
                  }
                />
                <div>
                  <Label htmlFor={`compliance-${framework.value}`} className="cursor-pointer">
                    {framework.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{framework.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Signals */}
      <CustomSignalsEditor
        signals={customSignals}
        onChange={setCustomSignals}
      />

      {/* Matching Rules */}
      <MatchingRulesEditor
        rules={matchingRules}
        onChange={setMatchingRules}
      />

      {/* Privacy Budget (Read-only) */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy Budget</CardTitle>
            <CardDescription>
              Differential privacy budget consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-muted-foreground">Budget (ε)</Label>
                <p className="text-2xl font-semibold">{profile.epsilon_budget.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Consumed</Label>
                <p className="text-2xl font-semibold">{profile.epsilon_consumed.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Remaining</Label>
                <p className="text-2xl font-semibold">
                  {Math.max(0, profile.epsilon_budget - profile.epsilon_consumed).toFixed(2)}
                </p>
              </div>
            </div>
            {profile.epsilon_consumed >= profile.epsilon_budget && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                <span>Privacy budget exhausted. Model training paused until reset.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save ML Settings
            </>
          )}
        </Button>
      </div>

      {/* Model Tier Change Modal */}
      <ModelTierModal
        open={showTierModal}
        onOpenChange={setShowTierModal}
        currentTier={modelTier}
        newTier={pendingTierChange}
        onConfirm={confirmTierChange}
      />
    </div>
  );
}
