import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Message Portal | Scrybe",
  description: "View your secure messages",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {children}
      </div>
    </div>
  );
}
