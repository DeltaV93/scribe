import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Outfit, IBM_Plex_Mono } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Brand fonts from Obsidian Signal brand guide
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans-brand",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
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
    default: "Scrybe",
    template: "%s | Scrybe",
  },
  description:
    "AI-powered case management and form automation for social services",
  keywords: [
    "case management",
    "social services",
    "form automation",
    "AI",
    "transcription",
  ],
  authors: [{ name: "Scrybe Solutions" }],
  creator: "Scrybe Solutions",
  metadataBase: getMetadataBaseUrl(),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scrybe",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Scrybe",
    title: "Scrybe - AI-Powered Case Management",
    description:
      "AI-powered case management and form automation for social services",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scrybe - AI-Powered Case Management",
    description:
      "AI-powered case management and form automation for social services",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${cormorantGaramond.variable} ${outfit.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
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
