/**
 * JSON-LD Structured Data Components
 *
 * Provides structured data for:
 * - Search engines (Google, Bing)
 * - AI agents and LLMs
 * - Rich snippets and featured snippets
 */

export interface OrganizationJsonLdProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
}

export function OrganizationJsonLd({
  name = "Inkra",
  url = "https://oninkra.com",
  logo = "https://oninkra.com/inkra-logo.svg",
  description = "Inkra builds conversation-to-work automation for healthcare, legal, nonprofit, and technology teams.",
}: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    legalName: "Phoenixing LLC",
    url,
    logo,
    description,
    email: "hello@inkra.app",
    sameAs: [
      // Add social links when available
      // "https://twitter.com/inkra",
      // "https://linkedin.com/company/inkra",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@inkra.app",
      contactType: "sales",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export interface SoftwareApplicationJsonLdProps {
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price?: string;
    priceCurrency?: string;
  };
}

export function SoftwareApplicationJsonLd({
  name = "Inkra",
  description = "Inkra is a conversation-to-work platform that automatically generates documentation, reports, tasks, and insights from team calls, meetings, and sessions. HIPAA compliant.",
  applicationCategory = "BusinessApplication",
  operatingSystem = "Web",
  offers = {
    price: "0",
    priceCurrency: "USD",
  },
}: SoftwareApplicationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory,
    operatingSystem,
    url: "https://oninkra.com",
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
      availability: "https://schema.org/PreOrder",
      description: "Pilot access — invite only",
    },
    creator: {
      "@type": "Organization",
      name: "Inkra",
      legalName: "Phoenixing LLC",
      url: "https://oninkra.com",
      email: "hello@inkra.app",
      description:
        "Inkra builds conversation-to-work automation for healthcare, legal, nonprofit, and technology teams.",
    },
    featureList: [
      "Automatic documentation from conversations",
      "SOAP notes and case notes generation",
      "Grant report compilation",
      "Task and follow-up creation",
      "Real-time conversation guides",
      "Organizational knowledge capture",
      "HIPAA compliant",
      "End-to-end encrypted",
    ],
    screenshot: "https://oninkra.com/og-image.png",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export interface FAQJsonLdProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export function FAQJsonLd({ questions }: FAQJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export interface HowToJsonLdProps {
  name: string;
  description: string;
  steps: Array<{
    name: string;
    text: string;
  }>;
}

export function HowToJsonLd({ name, description, steps }: HowToJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Default FAQ content for AEO (Answer Engine Optimization)
export const inkraFAQs = [
  {
    question: "What is a conversation-to-work platform?",
    answer:
      "A conversation-to-work platform automatically converts team calls, meetings, and sessions into completed downstream work — documentation, reports, tasks, CRM updates, compliance filings, and more — without manual data entry.",
  },
  {
    question: "How does Inkra differ from meeting note tools like Otter or Fireflies?",
    answer:
      "Meeting note tools transcribe and summarize. Inkra goes further: one conversation simultaneously generates case notes, SOAP notes, intake forms, grant reports, tasks, calendar events, and CRM updates. It replaces the work that happens after the meeting, not just the notes from it.",
  },
  {
    question: "Is Inkra HIPAA compliant?",
    answer:
      "Yes. Inkra is built for regulated industries with end-to-end encryption, PHI detection, differential privacy, full audit trails, and HIPAA-compliant infrastructure on AWS. Your data is never used for AI training.",
  },
  {
    question: "What industries does Inkra support?",
    answer:
      "Inkra serves healthcare and clinical teams, legal practices, nonprofits and social services, product and technology teams, sales organizations, HR departments, and support teams.",
  },
  {
    question: "What is Inkra?",
    answer:
      "Inkra is a conversation-to-work platform that automatically converts phone calls, meetings, and conversations into structured documentation including case notes, intake forms, follow-up tasks, and compliance reports. Unlike simple transcription tools, Inkra generates 6+ outputs from a single conversation.",
  },
  {
    question: "What channels does Inkra support?",
    answer:
      "Inkra captures conversations from multiple channels: VoIP phone calls (built-in), Zoom meetings, Google Meet, Microsoft Teams, and in-person conversations via mobile. One platform handles all conversation types.",
  },
  {
    question: "How much time does Inkra save?",
    answer:
      "Organizations using Inkra report 40-60% reduction in documentation time. Case managers who spent hours on manual data entry can complete documentation automatically during or immediately after conversations.",
  },
  {
    question: "Is Inkra available now?",
    answer:
      "Inkra is currently accepting applications for the Spring 2026 pilot program. Visit oninkra.com to apply for early access.",
  },
];
