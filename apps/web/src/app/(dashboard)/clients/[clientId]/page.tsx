import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClientProfile } from "@/components/clients/client-profile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ClientPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPage({ params }: ClientPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { clientId } = await params;

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Back to Clients</span>
      </div>

      {/* Profile */}
      <ClientProfile clientId={clientId} />
    </div>
  );
}
