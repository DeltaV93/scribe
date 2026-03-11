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
    default: "Inkra",
    template: "%s | Inkra",
  },
  description: "Conversation-to-Work Platform - Turn conversations into documentation automatically.",
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
  robots: {
    index: false, // App routes should not be indexed
    follow: false,
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
