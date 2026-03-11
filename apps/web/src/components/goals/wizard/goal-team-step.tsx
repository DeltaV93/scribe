"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GoalFormData } from "./goal-wizard";
import { Loader2, User, Users, GraduationCap } from "lucide-react";

interface GoalTeamStepProps {
  formData: GoalFormData;
  onChange: (updates: Partial<GoalFormData>) => void;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface ProgramOption {
  id: string;
  name: string;
  status: string;
}

export function GoalTeamStep({ formData, onChange }: GoalTeamStepProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [usersRes, teamsRes, programsRes] = await Promise.all([
          fetch("/api/users?limit=100"),
          fetch("/api/teams?limit=50"),
          fetch("/api/programs?limit=50"),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || []);
        }

        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.data || []);
        }

        if (programsRes.ok) {
          const data = await programsRes.json();
          setPrograms(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleProgram = (programId: string) => {
    const newProgramIds = formData.programIds.includes(programId)
      ? formData.programIds.filter((id) => id !== programId)
      : [...formData.programIds, programId];
    onChange({ programIds: newProgramIds });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Owner */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Owner
        </Label>
        <Select
          value={formData.ownerId || "none"}
          onValueChange={(value) =>
            onChange({ ownerId: value === "none" ? null : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No owner</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The person responsible for this goal
        </p>
      </div>

      {/* Team */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team
        </Label>
        <Select
          value={formData.teamId || "none"}
          onValueChange={(value) =>
            onChange({ teamId: value === "none" ? null : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No team</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Optional: Assign to a team for visibility
        </p>
      </div>

      {/* Programs */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Link Programs ({formData.programIds.length})
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Linking programs enables automatic progress tracking from enrollments and sessions.
        </p>
        {programs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No programs available</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {programs.map((program) => (
              <Card
                key={program.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleProgram(program.id)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox
                    checked={formData.programIds.includes(program.id)}
                    onCheckedChange={() => toggleProgram(program.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{program.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {program.status.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
