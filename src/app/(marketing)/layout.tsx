import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Inkra",
    default: "Inkra - Conversation-to-Work Platform",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
