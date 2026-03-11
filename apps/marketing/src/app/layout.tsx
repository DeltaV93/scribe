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
    default: "Inkra - Conversation-to-Work Platform",
    template: "%s | Inkra",
  },
  description:
    "Turn conversations into case notes, forms, tasks, and compliance reports automatically. AI documentation for nonprofits, healthcare, social services, and sales teams.",
  keywords: [
    "conversation to work platform",
    "conversation intelligence software",
    "AI documentation automation",
    "nonprofit case management AI",
    "AI case notes for social workers",
    "ambient clinical documentation",
    "HIPAA compliant transcription",
  ],
  authors: [{ name: "Inkra" }],
  creator: "Inkra",
  publisher: "Inkra",
  metadataBase: new URL("https://oninkra.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Inkra",
    title: "Inkra - Conversation-to-Work Platform",
    description:
      "Turn conversations into case notes, forms, tasks, and compliance reports automatically.",
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
    title: "Inkra - Conversation-to-Work Platform",
    description:
      "Turn conversations into case notes, forms, tasks, and compliance reports automatically.",
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
