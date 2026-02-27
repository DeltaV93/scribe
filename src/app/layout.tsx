import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

// Inter as fallback font
// Primary: Soehne (body) + Tiempos (headings) - loaded via @font-face in globals.css
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

function getMetadataBaseUrl(): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  // Add https:// if no protocol is specified
  if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    return new URL(`https://${appUrl}`);
  }
  return new URL(appUrl);
}

export const metadata: Metadata = {
  title: {
    default: "Inkra - Conversation-to-Work Platform",
    template: "%s | Inkra",
  },
  description:
    "Turn conversations into case notes, forms, tasks, and compliance reports automatically. AI documentation for nonprofits, healthcare, social services, and sales teams. One conversation becomes every workflow that follows.",
  keywords: [
    // Primary category
    "conversation to work platform",
    "conversation intelligence software",
    "AI documentation automation",
    // Industry-specific (nonprofits)
    "nonprofit case management AI",
    "AI case notes for social workers",
    "automated intake forms nonprofit",
    "WIOA compliance automation",
    "TANF reporting software",
    // Industry-specific (healthcare)
    "community health worker documentation",
    "CHW ambient documentation",
    "ambient clinical documentation",
    "HIPAA compliant transcription",
    // Industry-specific (sales)
    "conversation intelligence CRM",
    "AI sales documentation",
    "meeting to CRM automation",
    // Feature keywords
    "AI case notes SOAP DAP",
    "automated form filling AI",
    "conversation to compliance reports",
    "multi-output meeting AI",
    "VoIP transcription and extraction",
    // Comparison keywords
    "Otter alternative for nonprofits",
    "Gong alternative for social services",
    "Abridge alternative multi-industry",
  ],
  authors: [{ name: "Inkra" }],
  creator: "Inkra",
  publisher: "Inkra",
  metadataBase: getMetadataBaseUrl(),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inkra",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Inkra",
    title: "Inkra - Conversation-to-Work Platform",
    description:
      "Turn conversations into case notes, forms, tasks, and compliance reports automatically. One conversation becomes every workflow that follows.",
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
      "Turn conversations into case notes, forms, tasks, and compliance reports automatically. AI documentation for nonprofits, healthcare, and sales.",
    images: ["/og-image-twitter.png"],
    creator: "@inkra",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Skip link for accessibility */}
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
