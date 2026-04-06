import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "Inkra — Conversation-to-Work Platform | Auto-Documentation from Calls & Meetings",
    template: "%s | Inkra — Conversation-to-Work Platform",
  },
  description:
    "Inkra turns your team's calls, meetings, and sessions into completed documentation, reports, tasks, and insights — automatically. One conversation, six outputs. HIPAA compliant.",
  keywords: [
    "conversation to work platform",
    "conversation intelligence software",
    "AI documentation automation",
    "nonprofit case management AI",
    "AI case notes for social workers",
    "ambient clinical documentation",
    "HIPAA compliant transcription",
    "automatic case notes from calls",
    "SOAP notes generator from conversation",
    "grant report automation nonprofit",
    "auto documentation from phone calls",
    "Otter alternative for healthcare",
    "Fireflies alternative HIPAA compliant",
    "meeting AI that does more than transcribe",
    "conversation to workflow automation",
  ],
  authors: [{ name: "Inkra" }],
  creator: "Inkra",
  publisher: "Inkra",
  metadataBase: new URL("https://oninkra.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Inkra",
    title: "Inkra — Conversation-to-Work Platform",
    description:
      "One conversation generates documentation, reports, tasks, knowledge, context, and insights. Automatically. HIPAA compliant.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Inkra - Conversation-to-Work Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inkra — Conversation-to-Work Platform",
    description:
      "Your conversations do the work. Documentation, reports, tasks, insights — all automatic.",
    images: ["/og-image-twitter.png"],
    creator: "@inkra",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
