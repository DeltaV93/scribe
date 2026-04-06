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
  url = "https://inkra.ai",
  logo = "https://inkra.ai/inkra-logo.svg",
  description = "Conversation-to-Work Platform. Turn conversations into structured work automatically.",
}: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo,
    description,
    sameAs: [
      // Add social links when available
      // "https://twitter.com/inkra",
      // "https://linkedin.com/company/inkra",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@inkra.ai",
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
  description = "Conversation-to-Work Platform that turns phone calls, meetings, and conversations into case notes, forms, tasks, and compliance reports automatically.",
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
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
      availability: "https://schema.org/PreOrder",
      description: "Spring 2026 Pilot Program",
    },
    featureList: [
      "AI-generated case notes (SOAP, DAP, narrative formats)",
      "Automated form filling with field-level extraction",
      "Compliance reporting for WIOA, TANF, grant requirements",
      "Multi-channel: VoIP phone, Zoom, Google Meet, Teams",
      "Follow-up task generation with assignments",
      "Photo-based attendance capture",
      "Industry-configurable terminology",
      "HIPAA and SOC2 compliant",
    ],
    screenshot: "https://inkra.ai/og-image.png",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
      bestRating: "5",
      worstRating: "1",
    },
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
    question: "What is Inkra?",
    answer:
      "Inkra is a conversation-to-work platform that automatically converts phone calls, meetings, and conversations into structured documentation including case notes, intake forms, follow-up tasks, and compliance reports. Unlike simple transcription tools, Inkra generates 6+ outputs from a single conversation.",
  },
  {
    question: "How is Inkra different from Otter.ai or other meeting transcription tools?",
    answer:
      "While tools like Otter.ai focus on transcription and summaries, Inkra goes further by generating structured outputs: auto-filled forms, compliance reports, case notes in industry formats (SOAP, DAP), follow-up tasks with assignments, and calendar events. Inkra is built for organizations that need documentation automation, not just meeting notes.",
  },
  {
    question: "Who is Inkra designed for?",
    answer:
      "Inkra serves nonprofit case managers, community health workers, social services agencies, sales teams, UX researchers, legal intake specialists, and any organization where team members spend significant time documenting conversations. Primary verticals include nonprofits, healthcare, social services, and sales.",
  },
  {
    question: "Does Inkra support compliance requirements like HIPAA and WIOA?",
    answer:
      "Yes. Inkra is designed with compliance in mind, supporting HIPAA for healthcare, SOC2 for enterprise security, and automated reporting for grant requirements like WIOA and TANF. Audit logs track all activity for regulatory compliance.",
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
      "Inkra is currently accepting applications for the Spring 2026 pilot program. Visit inkra.ai to apply for early access.",
  },
  {
    question: "How does Inkra pricing work?",
    answer:
      "Inkra uses usage-based pricing starting around $15-50 per user per month, depending on volume and features. Contact us for enterprise pricing.",
  },
];
