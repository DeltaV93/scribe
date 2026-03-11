"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { ClientStatus } from "@prisma/client";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  internalId: string | null;
  status: ClientStatus;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Client not found");
          } else {
            setError("Failed to load client");
          }
          return;
        }
        const data = await response.json();
        setClient(data.data);
      } catch (err) {
        setError("Failed to load client");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [clientId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Back to Clients</span>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || "Client not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/clients")}>
            Go to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clients/${clientId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit {client.firstName} {client.lastName}
          </h1>
          <p className="text-muted-foreground">
            Update client information.
          </p>
        </div>
      </div>

      {/* Form */}
      <ClientForm mode="edit" initialData={client} />
    </div>
  );
}
