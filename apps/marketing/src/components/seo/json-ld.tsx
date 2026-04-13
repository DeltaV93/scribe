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
  description = "Inkra is the conversation-to-work platform. It joins calls and meetings and automatically generates the completed downstream work that results from them — case notes, SOAP notes, intake forms, grant reports, CRM updates, and compliance filings.",
}: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://oninkra.com/#organization",
    name,
    alternateName: ["Inkra (by Enigma Syndicate LLC)", "oninkra"],
    legalName: "Enigma Syndicate LLC",
    url,
    logo: {
      "@type": "ImageObject",
      url: logo,
      width: 512,
      height: 512,
    },
    image: "https://oninkra.com/og-image.png",
    description,
    slogan: "Your words work.",
    email: "hello@inkra.app",
    foundingDate: "2025",
    knowsAbout: [
      "Conversation-to-Work",
      "Conversation intelligence",
      "Auto-documentation",
      "HIPAA-compliant AI",
      "Case management software",
      "SOAP notes automation",
      "Grant reporting",
    ],
    sameAs: [
      "https://inkra.io",
      "https://www.linkedin.com/company/inkra",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: "hello@inkra.app",
        contactType: "sales",
        areaServed: "US",
        availableLanguage: ["en"],
      },
      {
        "@type": "ContactPoint",
        email: "hello@inkra.app",
        contactType: "customer support",
        areaServed: "US",
        availableLanguage: ["en"],
      },
    ],
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
  description = "Inkra is the conversation-to-work platform. It joins calls and meetings and automatically generates completed case notes, SOAP notes, intake forms, grant reports, CRM updates, and compliance filings from a single conversation. HIPAA compliant.",
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
    "@id": "https://oninkra.com/#software",
    name,
    alternateName: "Inkra Conversation-to-Work Platform",
    description,
    applicationCategory,
    applicationSubCategory: "Conversation-to-Work Platform",
    operatingSystem,
    url: "https://oninkra.com",
    sameAs: ["https://inkra.io"],
    softwareVersion: "1.0",
    releaseNotes: "Spring 2026 closed pilot",
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
      availability: "https://schema.org/PreOrder",
      description: "Pilot access — invite only. Contact sales for pricing.",
      url: "https://oninkra.com/demo",
    },
    creator: {
      "@type": "Organization",
      "@id": "https://oninkra.com/#organization",
      name: "Inkra",
      legalName: "Enigma Syndicate LLC",
      url: "https://oninkra.com",
      email: "hello@inkra.app",
      description:
        "Inkra builds the conversation-to-work platform for healthcare, legal, nonprofit, and technology teams.",
    },
    publisher: {
      "@type": "Organization",
      "@id": "https://oninkra.com/#organization",
      name: "Inkra",
    },
    featureList: [
      "Conversation capture from phone calls, Zoom, Google Meet, Microsoft Teams, and in-person sessions",
      "Auto-documentation: case notes, SOAP notes, intake forms, PRDs, standup summaries",
      "Grant report and compliance filing generation",
      "Task, follow-up, and CRM update automation",
      "Real-time conversation guides and prompts",
      "Organizational knowledge system captured from practice",
      "Workforce intelligence and performance visibility",
      "IRL-to-digital: paper attendance capture via photo upload",
      "HIPAA compliant",
      "End-to-end encrypted",
      "PHI detection and redaction",
      "Differential privacy with fixed synthesis threshold",
      "Full audit trail",
      "Per-org model isolation — your data never trains shared models",
    ],
    screenshot: "https://oninkra.com/og-image.png",
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Nonprofits, healthcare providers, legal practices, sales teams, product teams, UX researchers, HR teams, customer support teams",
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
      "Inkra is a conversation-to-work platform. It joins your phone calls and meetings, listens to what is discussed, and automatically generates the completed downstream work — case notes, SOAP notes, intake forms, grant reports, CRM updates, tasks, and compliance filings. One conversation produces every artifact that would otherwise require manual data entry.",
  },
  {
    question: "What is a conversation-to-work platform?",
    answer:
      "A conversation-to-work platform automatically converts team calls, meetings, and sessions into completed downstream work — documentation, reports, tasks, CRM updates, compliance filings, and more — without manual data entry. Inkra coined the category: unlike meeting note tools that stop at transcription, conversation-to-work platforms generate the actual work artifacts that result from a conversation.",
  },
  {
    question: "How does Inkra work?",
    answer:
      "Inkra joins your calls, meetings, and in-person sessions through VoIP phone, Zoom, Google Meet, Microsoft Teams, or the mobile app. It listens with all-party consent, captures the conversation, and routes the content through a Capture → Workflow → Memory architecture. Within seconds of the conversation ending, Inkra generates completed case notes, forms, reports, tasks, and CRM updates tailored to your organization's templates.",
  },
  {
    question: "How does Inkra differ from meeting note tools like Otter, Fireflies, or Granola?",
    answer:
      "Meeting note tools transcribe and summarize. Inkra goes further: one conversation simultaneously generates case notes, SOAP notes, intake forms, grant reports, tasks, calendar events, and CRM updates. It replaces the work that happens after the meeting, not just the notes from it. Otter, Fireflies, and Granola are horizontal note tools. Inkra is a vertical conversation-to-work platform built for regulated and high-documentation industries.",
  },
  {
    question: "What industries does Inkra serve?",
    answer:
      "Inkra serves healthcare and clinical teams, legal practices, nonprofits and social services, product and technology teams, sales organizations, HR departments, UX research teams, and customer support teams. Any industry where conversations drive downstream work is a fit.",
  },
  {
    question: "Is Inkra HIPAA compliant?",
    answer:
      "Yes. Inkra is built privacy-by-design for regulated industries. It includes end-to-end encryption, PHI detection and redaction, differential privacy with a fixed synthesis threshold, full audit trails, all-party consent by default, per-organization model isolation, and HIPAA-compliant infrastructure on AWS. Your data is never used to train shared AI models.",
  },
  {
    question: "What channels does Inkra support?",
    answer:
      "Inkra captures conversations from VoIP phone calls, Zoom meetings, Google Meet, Microsoft Teams, standups, and in-person conversations via mobile. It also supports IRL-to-digital workflows — snap a photo of a paper attendance sheet and Inkra logs it.",
  },
  {
    question: "How much time does Inkra save?",
    answer:
      "Organizations in Inkra's pilot report 40-60% reduction in documentation time. Case managers who spent hours on manual data entry complete documentation automatically during or immediately after conversations. Quarterly grant reports that took 20+ hours are generated in minutes.",
  },
  {
    question: "Is Inkra available now?",
    answer:
      "Inkra is currently in a closed pilot with a nonprofit partner and accepting applications for the Spring 2026 pilot program. Visit oninkra.com/demo/ to request access.",
  },
];
