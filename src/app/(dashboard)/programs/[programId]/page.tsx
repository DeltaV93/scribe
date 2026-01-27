"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgramStatusBadge } from "@/components/programs/program-status-badge";
import { ProgramStatsCard } from "@/components/programs/program-stats-card";
import { SessionsTab } from "@/components/programs/sessions-tab";
import { EnrollmentsTab } from "@/components/programs/enrollments-tab";
import { MaterialsTab } from "@/components/programs/materials-tab";
import { ProgramAttendanceDashboard } from "@/components/attendance/reports/program-attendance-dashboard";
import { ProgramLabelType, ProgramStatus } from "@prisma/client";
import {
  ArrowLeft,
  Edit,
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface Program {
  id: string;
  name: string;
  labelType: ProgramLabelType;
  description: string | null;
  requiredHours: number | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  maxEnrollment: number | null;
  status: ProgramStatus;
  facilitator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    sessions: number;
    enrollments: number;
    materials: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        const response = await fetch(`/api/programs/${programId}`);
        if (response.ok) {
          const data = await response.json();
          setProgram(data.data);
        } else if (response.status === 404) {
          router.push("/programs");
        }
      } catch (error) {
        console.error("Error fetching program:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgram();
  }, [programId, router]);

  const formatLabelType = (type: ProgramLabelType) => {
    const labels: Record<ProgramLabelType, string> = {
      PROGRAM: "Program",
      COURSE: "Course",
      CLASS: "Class",
      WORKSHOP: "Workshop",
      TRAINING: "Training",
      GROUP: "Group",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Program not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/programs")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{program.name}</h1>
              <ProgramStatusBadge status={program.status} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{formatLabelType(program.labelType)}</span>
              {program.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(program.startDate), "MMM d, yyyy")}
                  {program.endDate && ` - ${format(new Date(program.endDate), "MMM d, yyyy")}`}
                </span>
              )}
              {program.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {program.location}
                </span>
              )}
            </div>
            {program.description && (
              <p className="mt-2 text-muted-foreground max-w-2xl">{program.description}</p>
            )}
          </div>
        </div>
        <Button onClick={() => router.push(`/programs/${programId}/edit`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Stats */}
      <ProgramStatsCard programId={programId} />

      {/* Quick Info */}
      <div className="flex flex-wrap gap-6 text-sm">
        {program.requiredHours && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{program.requiredHours}</span>
            <span className="text-muted-foreground">hours required</span>
          </div>
        )}
        {program.maxEnrollment && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{program._count?.enrollments || 0}</span>
            <span className="text-muted-foreground">/ {program.maxEnrollment} enrolled</span>
          </div>
        )}
        {program.facilitator && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Facilitator:</span>
            <span className="font-medium">
              {program.facilitator.name || program.facilitator.email}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">
            Sessions ({program._count?.sessions || 0})
          </TabsTrigger>
          <TabsTrigger value="attendance">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            Enrollments ({program._count?.enrollments || 0})
          </TabsTrigger>
          <TabsTrigger value="materials">
            Materials ({program._count?.materials || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab programId={programId} />
        </TabsContent>

        <TabsContent value="attendance">
          <ProgramAttendanceDashboard programId={programId} />
        </TabsContent>

        <TabsContent value="enrollments">
          <EnrollmentsTab programId={programId} />
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsTab programId={programId} programName={program.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
