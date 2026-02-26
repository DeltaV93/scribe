import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

// Inter-only typography for enterprise signal
// INKRA: "If it's not clear, it's not premium. If it's not consistent, it's not trustworthy."
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
    default: "Inkra",
    template: "%s | Inkra",
  },
  description:
    "Conversation-to-Work Platform. Turn conversations into structured work automatically.",
  keywords: [
    "conversation intelligence",
    "documentation automation",
    "organizational memory",
    "meeting intelligence",
    "AI documentation",
    "form automation",
  ],
  authors: [{ name: "Inkra" }],
  creator: "Inkra",
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
      "Turn conversations into structured work automatically. Less documenting. More doing.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inkra - Conversation-to-Work Platform",
    description:
      "Turn conversations into structured work automatically. Less documenting. More doing.",
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
      <body className={`${inter.variable} font-sans antialiased`}>
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
