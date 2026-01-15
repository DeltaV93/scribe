"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CallInterface } from "@/components/calls/call-interface";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { CallStatus } from "@prisma/client";

interface CallData {
  id: string;
  status: CallStatus;
  formIds: string[];
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    author?: {
      name: string | null;
      email: string;
    };
  }>;
}

interface Form {
  id: string;
  name: string;
  fields: Array<{
    id: string;
    slug: string;
    label: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

export default function CallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [call, setCall] = useState<CallData | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch call data
        const callResponse = await fetch(`/api/calls/${callId}`);
        if (!callResponse.ok) {
          if (callResponse.status === 404) {
            setError("Call not found");
          } else {
            setError("Failed to load call");
          }
          return;
        }

        const callData = await callResponse.json();
        setCall(callData.data);

        // If call is completed, redirect to review
        if (
          callData.data.status === CallStatus.COMPLETED ||
          callData.data.status === CallStatus.FAILED ||
          callData.data.status === CallStatus.ABANDONED
        ) {
          router.replace(`/calls/${callId}/review`);
          return;
        }

        // Fetch forms if any were selected
        if (callData.data.formIds && callData.data.formIds.length > 0) {
          const formPromises = callData.data.formIds.map((id: string) =>
            fetch(`/api/forms/${id}`).then((r) => (r.ok ? r.json() : null))
          );
          const formResults = await Promise.all(formPromises);
          setForms(
            formResults.filter((f) => f !== null).map((f) => f.data)
          );
        }
      } catch (err) {
        setError("Failed to load call");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [callId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/calls">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Back to Calls</span>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || "Call not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/calls")}>
            Go to Calls
          </Button>
        </div>
      </div>
    );
  }

  // Transform forms into sections for the conversation guide
  const formSections = forms.map((form) => ({
    formId: form.id,
    formName: form.name,
    fields: form.fields.map((field) => ({
      id: field.id,
      slug: field.slug,
      label: field.label,
      type: field.type,
      required: field.required,
      description: field.description,
    })),
  }));

  return (
    <div className="h-screen flex flex-col">
      <CallInterface
        callId={call.id}
        client={call.client}
        formSections={formSections}
        previousNotes={call.notes}
        initialStatus={call.status}
      />
    </div>
  );
}
