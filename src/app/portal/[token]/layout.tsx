"use client";

import { useParams } from "next/navigation";
import { PortalSessionProvider } from "@/components/portal/portal-session-provider";
import { BottomNav } from "@/components/portal/bottom-nav";

export default function PortalTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const token = params.token as string;

  return (
    <PortalSessionProvider token={token}>
      <div className="min-h-screen pb-20">
        <div className="container max-w-lg mx-auto py-4 px-4">
          {children}
        </div>
        <BottomNav />
      </div>
    </PortalSessionProvider>
  );
}
