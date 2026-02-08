"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Plus,
  X,
  Save,
  User,
  Briefcase,
  Languages,
  Award,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface CaseManagerProfile {
  userId: string;
  maxCaseload: number;
  currentCaseload: number;
  spotsAvailable: number;
  skills: string[];
  languages: string[];
  specializations: string[];
  availabilityStatus: string;
  availabilityNote: string | null;
  preferredClientTypes: string[];
  createdAt: string;
  updatedAt: string;
}

interface CaseManagerProfileFormProps {
  userId: string;
  userName?: string;
  isOwnProfile?: boolean;
  onSaved?: () => void;
}

const AVAILABILITY_OPTIONS = [
  { value: "AVAILABLE", label: "Available", description: "Ready to accept new clients" },
  { value: "LIMITED", label: "Limited", description: "Can accept some new clients" },
  { value: "UNAVAILABLE", label: "Unavailable", description: "Cannot accept new clients" },
  { value: "ON_LEAVE", label: "On Leave", description: "Temporarily away" },
];

const COMMON_SKILLS = [
  "Crisis Intervention",
  "Motivational Interviewing",
  "Trauma-Informed Care",
  "Case Documentation",
  "Benefits Navigation",
  "Housing Assistance",
  "Employment Services",
  "Mental Health Support",
  "Substance Abuse Counseling",
  "Family Mediation",
];

const COMMON_LANGUAGES = [
  "English",
  "Spanish",
  "Mandarin",
  "Cantonese",
  "Vietnamese",
  "Tagalog",
  "Korean",
  "Russian",
  "Arabic",
  "French",
  "Portuguese",
  "Hindi",
];

const COMMON_SPECIALIZATIONS = [
  "Youth Services",
  "Elderly Care",
  "Veterans",
  "Families with Children",
  "Single Adults",
  "Domestic Violence",
  "Substance Abuse",
  "Mental Health",
  "Homelessness",
  "Immigration",
  "Disability Services",
  "Re-Entry",
];

export function CaseManagerProfileForm({
  userId,
  userName,
  isOwnProfile = false,
  onSaved,
}: CaseManagerProfileFormProps) {
  const [profile, setProfile] = useState<CaseManagerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Form state
  const [maxCaseload, setMaxCaseload] = useState(30);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("AVAILABLE");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [preferredClientTypes, setPreferredClientTypes] = useState<string[]>([]);

  // Input states for adding new items
  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newSpecialization, setNewSpecialization] = useState("");
  const [newClientType, setNewClientType] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/case-managers/${userId}/profile`);
      if (response.ok) {
        const data = await response.json();
        const p = data.data;
        setProfile(p);
        setMaxCaseload(p.maxCaseload);
        setSkills(p.skills);
        setLanguages(p.languages);
        setSpecializations(p.specializations);
        setAvailabilityStatus(p.availabilityStatus);
        setAvailabilityNote(p.availabilityNote || "");
        setPreferredClientTypes(p.preferredClientTypes);
        setIsDirty(false);
      } else {
        toast.error("Failed to load profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/case-managers/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxCaseload,
          skills,
          languages,
          specializations,
          availabilityStatus,
          availabilityNote: availabilityNote || null,
          preferredClientTypes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.data);
        setIsDirty(false);
        toast.success("Profile saved successfully");
        onSaved?.();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || "Failed to save profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  const addItem = (
    list: string[],
    setList: (items: string[]) => void,
    value: string,
    setValue: (v: string) => void
  ) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setValue("");
      markDirty();
    }
  };

  const removeItem = (list: string[], setList: (items: string[]) => void, item: string) => {
    setList(list.filter((i) => i !== item));
    markDirty();
  };

  const addFromSuggestion = (
    list: string[],
    setList: (items: string[]) => void,
    item: string
  ) => {
    if (!list.includes(item)) {
      setList([...list, item]);
      markDirty();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading profile...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const utilizationPercent = profile
    ? Math.round((profile.currentCaseload / maxCaseload) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {isOwnProfile ? "My Case Manager Profile" : `${userName || "Case Manager"}'s Profile`}
              </CardTitle>
              <CardDescription>
                {isOwnProfile
                  ? "Manage your caseload capacity, skills, and availability"
                  : "View and edit case manager profile settings"}
              </CardDescription>
            </div>
            {isDirty && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Unsaved changes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Current Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Current Caseload</div>
              <div className="text-2xl font-bold">
                {profile?.currentCaseload || 0} / {maxCaseload}
              </div>
              <Progress value={utilizationPercent} className="h-2 mt-2" />
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Available Spots</div>
              <div className="text-2xl font-bold text-green-600">
                {maxCaseload - (profile?.currentCaseload || 0)}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Availability Status</div>
              <div className="text-lg font-medium">
                {AVAILABILITY_OPTIONS.find((o) => o.value === availabilityStatus)?.label || availabilityStatus}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Caseload Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Caseload Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCaseload">Maximum Caseload</Label>
                <Input
                  id="maxCaseload"
                  type="number"
                  min={0}
                  max={200}
                  value={maxCaseload}
                  onChange={(e) => {
                    setMaxCaseload(parseInt(e.target.value) || 0);
                    markDirty();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of active clients you can handle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availabilityStatus">Availability Status</Label>
                <Select
                  value={availabilityStatus}
                  onValueChange={(value) => {
                    setAvailabilityStatus(value);
                    markDirty();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div>{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(availabilityStatus === "LIMITED" ||
              availabilityStatus === "UNAVAILABLE" ||
              availabilityStatus === "ON_LEAVE") && (
              <div className="space-y-2">
                <Label htmlFor="availabilityNote">Availability Note</Label>
                <Textarea
                  id="availabilityNote"
                  placeholder="e.g., Back on February 15th, or Limited to 2 new clients per week"
                  value={availabilityNote}
                  onChange={(e) => {
                    setAvailabilityNote(e.target.value);
                    markDirty();
                  }}
                  maxLength={500}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Languages className="h-5 w-5" />
            Languages Spoken
          </CardTitle>
          <CardDescription>Languages you can communicate in with clients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Badge key={lang} variant="secondary" className="pl-3 pr-1 py-1">
                {lang}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => removeItem(languages, setLanguages, lang)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a language..."
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(languages, setLanguages, newLanguage, setNewLanguage);
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => addItem(languages, setLanguages, newLanguage, setNewLanguage)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Quick add:</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {COMMON_LANGUAGES.filter((l) => !languages.includes(l))
                .slice(0, 8)
                .map((lang) => (
                  <Button
                    key={lang}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => addFromSuggestion(languages, setLanguages, lang)}
                  >
                    + {lang}
                  </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5" />
            Skills & Competencies
          </CardTitle>
          <CardDescription>Professional skills for client matching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} variant="outline" className="pl-3 pr-1 py-1">
                {skill}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => removeItem(skills, setSkills, skill)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {skills.length === 0 && (
              <span className="text-sm text-muted-foreground">No skills added yet</span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(skills, setSkills, newSkill, setNewSkill);
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => addItem(skills, setSkills, newSkill, setNewSkill)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Suggested skills:</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {COMMON_SKILLS.filter((s) => !skills.includes(s))
                .slice(0, 6)
                .map((skill) => (
                  <Button
                    key={skill}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => addFromSuggestion(skills, setSkills, skill)}
                  >
                    + {skill}
                  </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Specializations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5" />
            Specializations
          </CardTitle>
          <CardDescription>Areas of expertise for client matching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {specializations.map((spec) => (
              <Badge key={spec} variant="secondary" className="pl-3 pr-1 py-1">
                {spec}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => removeItem(specializations, setSpecializations, spec)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {specializations.length === 0 && (
              <span className="text-sm text-muted-foreground">No specializations added yet</span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a specialization..."
              value={newSpecialization}
              onChange={(e) => setNewSpecialization(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(specializations, setSpecializations, newSpecialization, setNewSpecialization);
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() =>
                addItem(specializations, setSpecializations, newSpecialization, setNewSpecialization)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Common specializations:</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {COMMON_SPECIALIZATIONS.filter((s) => !specializations.includes(s))
                .slice(0, 6)
                .map((spec) => (
                  <Button
                    key={spec}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => addFromSuggestion(specializations, setSpecializations, spec)}
                  >
                    + {spec}
                  </Button>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferred Client Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferred Client Types</CardTitle>
          <CardDescription>Types of clients you prefer working with (optional)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {preferredClientTypes.map((type) => (
              <Badge key={type} variant="outline" className="pl-3 pr-1 py-1">
                {type}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  onClick={() => removeItem(preferredClientTypes, setPreferredClientTypes, type)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {preferredClientTypes.length === 0 && (
              <span className="text-sm text-muted-foreground">No preferences set (all types)</span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a client type preference..."
              value={newClientType}
              onChange={(e) => setNewClientType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(preferredClientTypes, setPreferredClientTypes, newClientType, setNewClientType);
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() =>
                addItem(preferredClientTypes, setPreferredClientTypes, newClientType, setNewClientType)
              }
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        {isDirty && (
          <Button variant="outline" onClick={fetchProfile}>
            Discard Changes
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
