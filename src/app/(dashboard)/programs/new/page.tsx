"use client";

import { ProgramForm } from "@/components/programs/program-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NewProgramPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Program</h1>
          <p className="text-muted-foreground">
            Create a new program, course, or training.
          </p>
        </div>
      </div>

      {/* Form */}
      <ProgramForm />
    </div>
  );
}
