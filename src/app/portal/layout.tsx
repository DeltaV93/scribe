import { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { FathomProvider } from "@/components/portal/fathom-provider";

export const metadata: Metadata = {
  title: "Client Portal | Scrybe",
  description: "Secure client portal for messages and program tracking",
  manifest: "/portal-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scrybe Portal",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0ea5e9",
};

export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Suspense>
        <FathomProvider>{children}</FathomProvider>
      </Suspense>
    </div>
  );
}
