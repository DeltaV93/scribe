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
      "Inkra — Conversation-to-Work Platform | Your Words Work",
    template: "%s | Inkra — Conversation-to-Work Platform",
  },
  description:
    "Inkra is the conversation-to-work platform. It joins your calls and meetings and automatically generates completed case notes, SOAP notes, intake forms, grant reports, CRM updates, and compliance filings. One conversation, every downstream artifact — HIPAA compliant.",
  keywords: [
    "conversation-to-work",
    "conversation-to-work platform",
    "conversation to work platform",
    "Inkra",
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
    "Granola alternative for case managers",
    "meeting AI that does more than transcribe",
    "conversation to workflow automation",
  ],
  authors: [{ name: "Inkra", url: "https://oninkra.com" }],
  creator: "Inkra",
  publisher: "Phoenixing LLC",
  metadataBase: new URL("https://oninkra.com"),
  alternates: {
    canonical: "/",
  },
  applicationName: "Inkra",
  category: "Business Software",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Inkra",
    url: "https://oninkra.com",
    title: "Inkra — Conversation-to-Work Platform | Your Words Work",
    description:
      "The conversation-to-work platform. One conversation automatically generates case notes, SOAP notes, intake forms, grant reports, CRM updates, and compliance filings. HIPAA compliant.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Inkra — Conversation-to-Work Platform. Your words become completed work.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@inkra",
    creator: "@inkra",
    title: "Inkra — Conversation-to-Work Platform | Your Words Work",
    description:
      "The conversation-to-work platform. One conversation generates every downstream artifact — case notes, SOAP notes, intake forms, grant reports, tasks, CRM updates. HIPAA compliant.",
    images: [
      {
        url: "/og-image-twitter.png",
        alt: "Inkra — Conversation-to-Work Platform",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/inkra-logo.svg",
  },
  other: {
    "format-detection": "telephone=no",
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
