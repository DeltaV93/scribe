"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProgramForm } from "@/components/programs/program-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProgramLabelType, ProgramStatus } from "@prisma/client";

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
}

export default function EditProgramPage() {
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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Program</h1>
          <p className="text-muted-foreground">{program.name}</p>
        </div>
      </div>

      {/* Form */}
      <ProgramForm initialData={program} mode="edit" />
    </div>
  );
}
