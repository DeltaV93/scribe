import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - Conversation Intelligence for Nonprofits & Healthcare",
  description:
    "Conversation intelligence pricing for nonprofits and healthcare. Inkra automates documentation, case notes, and compliance reporting. Apply for pilot pricing - founding member rates locked in for life.",
  keywords: [
    // Primary target keywords
    "conversation intelligence pricing",
    "nonprofit documentation software cost",
    // Industry-specific
    "nonprofit case management software pricing",
    "healthcare documentation software cost",
    "social services documentation automation pricing",
    "community health worker software pricing",
    // Feature-specific
    "AI case notes pricing",
    "automated compliance reporting cost",
    "HIPAA compliant transcription pricing",
    "grant reporting software pricing",
    "WIOA documentation software",
    "TANF reporting software cost",
    // Comparison keywords
    "Otter alternative for nonprofits",
    "Gong alternative for social services",
    "Abridge alternative pricing",
    // Intent keywords
    "conversation to documentation pricing",
    "meeting transcription software cost",
    "voice to case notes pricing",
  ],
  openGraph: {
    title: "Pricing - Inkra Conversation Intelligence",
    description:
      "Conversation intelligence pricing for nonprofits and healthcare. Apply for pilot pricing and lock in founding member rates. White-glove onboarding included.",
    url: "https://inkra.ai/pricing",
    siteName: "Inkra",
    type: "website",
    images: [
      {
        url: "/og-image-pricing.png",
        width: 1200,
        height: 630,
        alt: "Inkra Pricing - Conversation Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - Inkra Conversation Intelligence",
    description:
      "Conversation intelligence pricing for nonprofits and healthcare. Founding member pricing available for Spring 2026 pilot.",
    images: ["/og-image-pricing.png"],
  },
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
