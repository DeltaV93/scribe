import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Use Cases - Industry Solutions",
  description:
    "Discover how Inkra transforms conversations into work across industries. Nonprofits reduce documentation by 60%. Healthcare automates SOAP notes. Sales captures relationship intelligence. UX Research surfaces patterns. Legal indexes every client call.",
  keywords: [
    "conversation automation use cases",
    "AI documentation by industry",
    "nonprofit case management software",
    "healthcare ambient documentation",
    "sales conversation intelligence",
    "community health worker tools",
    "case manager documentation AI",
    "WIOA TANF compliance automation",
    "UX research interview software",
    "legal intake automation",
    "user interview analysis AI",
    "law firm documentation software",
  ],
  openGraph: {
    title: "Use Cases - Industry Solutions | Inkra",
    description:
      "Discover how Inkra transforms conversations into work across nonprofits, healthcare, sales, UX research, and legal.",
    images: [
      {
        url: "/og_imgs/use-cases.png",
        width: 1200,
        height: 630,
        alt: "Inkra Use Cases - Industry Solutions",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases",
  },
};

// JSON-LD for use cases collection
function UseCasesJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Inkra Industry Solutions",
    description:
      "How Inkra transforms conversations into structured work across nonprofits, healthcare, sales, UX research, and legal.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Nonprofits & Social Services",
          url: "https://inkra.ai/use-cases/nonprofits",
          description:
            "Case management AI that reduces documentation time by 40-60% while ensuring WIOA/TANF compliance.",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Healthcare & Community Health",
          url: "https://inkra.ai/use-cases/healthcare",
          description:
            "HIPAA-compliant ambient documentation that generates SOAP notes and billing documentation automatically.",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Sales & Account Management",
          url: "https://inkra.ai/use-cases/sales",
          description:
            "Conversation intelligence that captures relationship details, updates CRM, and enables seamless handoffs.",
        },
        {
          "@type": "ListItem",
          position: 4,
          name: "UX Research",
          url: "https://inkra.ai/use-cases/ux-research",
          description:
            "User interview analysis that auto-captures conversations, generates notes, and surfaces cross-interview patterns.",
        },
        {
          "@type": "ListItem",
          position: 5,
          name: "Legal Services",
          url: "https://inkra.ai/use-cases/legal",
          description:
            "Client intake automation that indexes every call, builds matter timelines, and captures billable time accurately.",
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const useCases = [
  {
    slug: "nonprofits",
    title: "Nonprofits & Social Services",
    subtitle: "Let case managers focus on people, not paperwork",
    stat: "40-60%",
    statLabel: "doc time reduction",
    description:
      "Case managers spend 40% of their time on documentation. Inkra captures calls, generates case notes, fills intake forms, and compiles grant reports automatically. WIOA and TANF compliant.",
    features: [
      "Auto-generated case notes (SOAP, DAP, narrative)",
      "Grant reporting with real data",
      "Photo-upload attendance for group sessions",
      "Multi-partner data sharing",
    ],
    color: "ink-green",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    slug: "healthcare",
    title: "Healthcare & Community Health",
    subtitle: "Ambient documentation that captures everything",
    stat: "90 min",
    statLabel: "saved daily per provider",
    description:
      "CHWs and clinicians spend hours after shifts documenting. Inkra listens to visits, generates SOAP notes, extracts billing codes, and tracks treatment plans across sessions. HIPAA compliant.",
    features: [
      "SOAP notes generated in real-time",
      "Billing code extraction (CPT/ICD-10)",
      "Multi-session treatment tracking",
      "Secure, end-to-end encrypted",
    ],
    color: "ink-blue",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
        />
      </svg>
    ),
  },
  {
    slug: "sales",
    title: "Sales & Account Management",
    subtitle: "Never lose relationship context again",
    stat: "$2M+",
    statLabel: "pipeline protected per transition",
    description:
      "When your top rep gets promoted, their relationships go with them. Inkra captures every call detail, syncs to CRM, and enables seamless handoffs with complete relationship history.",
    features: [
      "Auto-sync to Salesforce, HubSpot, Pipedrive",
      "Relationship intelligence capture",
      "Deal stage tracking from conversations",
      "Handoff continuity reports",
    ],
    color: "ink-amber",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
        />
      </svg>
    ),
  },
  {
    slug: "ux-research",
    title: "UX Research",
    subtitle: "Be present in interviews, not stuck taking notes",
    stat: "90 min",
    statLabel: "saved per interview",
    description:
      "Your best insights come when you stop taking notes and start listening. Inkra captures interviews, generates notes in your template, and surfaces cross-interview patterns automatically.",
    features: [
      "Full interview transcription",
      "Cross-interview pattern detection",
      "Notes in your template format",
      "PRD input auto-population",
    ],
    color: "ink-blue",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    slug: "legal",
    title: "Legal Services",
    subtitle: "Every client call indexed and searchable",
    stat: "2 hrs",
    statLabel: "saved daily on documentation",
    description:
      "Attorney Kim has 40 active matters. Inkra indexes every client conversation, builds matter timelines, captures billable time, and prepares trial-ready documentation.",
    features: [
      "Client call transcription & indexing",
      "Matter timeline auto-generation",
      "Accurate billable time capture",
      "Cross-matter search",
    ],
    color: "ink-blue",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
        />
      </svg>
    ),
  },
];

export default function UseCasesIndexPage() {
  return (
    <>
      <UseCasesJsonLd />

      <MarketingNav currentPath="/use-cases" />
      <main className="min-h-screen bg-[var(--paper)]">

        {/* Hero */}
        <section className="pt-32 pb-20 px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              Industry Solutions
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              One platform.
              <br />
              <em className="text-[var(--ink-blue-accent)]">Every industry.</em>
            </h1>
            <p className="text-lg text-[var(--ink-muted)] max-w-xl mx-auto">
              If your team runs on conversations, Inkra turns those
              conversations into structured work. Documentation, reports, tasks,
              and compliance - all automatic.
            </p>
          </div>
        </section>

        {/* Use Cases Grid */}
        <section className="px-8 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {useCases.map((useCase) => (
                <Link
                  key={useCase.slug}
                  href={`/use-cases/${useCase.slug}`}
                  className="group relative bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-8 transition-all hover:border-[var(--ink-blue-accent)] hover:shadow-lg hover:-translate-y-1"
                >
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                      useCase.color === "ink-green"
                        ? "bg-[var(--ink-green-wash)] text-[var(--ink-green)]"
                        : useCase.color === "ink-blue"
                          ? "bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)]"
                          : "bg-[var(--ink-amber-wash)] text-[var(--ink-amber)]"
                    }`}
                  >
                    {useCase.icon}
                  </div>

                  {/* Content */}
                  <h2 className="font-serif text-2xl font-normal mb-2 group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    {useCase.title}
                  </h2>
                  <p className="text-sm text-[var(--ink-muted)] mb-6">
                    {useCase.subtitle}
                  </p>

                  {/* Stat */}
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="font-serif text-4xl text-[var(--ink-blue-accent)]">
                      {useCase.stat}
                    </span>
                    <span className="text-sm text-[var(--ink-muted)]">
                      {useCase.statLabel}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-6">
                    {useCase.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8">
                    {useCase.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[var(--ink-muted)]"
                      >
                        <span className="text-[var(--ink-green)] mt-0.5">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-blue-accent)] group-hover:gap-3 transition-all">
                    Learn more
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* More Industries */}
        <section className="px-8 pb-24">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              Also works for
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "People Management",
                "Product Teams",
                "Customer Support",
                "Real Estate",
                "Education",
                "Multi-Location Ops",
              ].map((industry) => (
                <span
                  key={industry}
                  className="px-4 py-2 text-sm text-[var(--ink-muted)] border border-[var(--border)] rounded-full hover:border-[var(--ink-blue-accent)] hover:text-[var(--ink-blue-accent)] hover:bg-[var(--ink-blue-wash)] transition-all cursor-default"
                >
                  {industry}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-8 py-24 bg-[var(--ink-blue)] text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="max-w-xl mx-auto text-center relative">
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-4">
              Your conversations should
              <br />
              <em>do the work.</em>
            </h2>
            <p className="text-white/70 mb-8">
              20 founding organizations get priority pricing, white-glove
              onboarding, and direct roadmap input.
            </p>
            <Link
              href="/#cta"
              className="inline-block px-8 py-4 bg-white text-[var(--ink-blue)] font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-xl transition-all"
            >
              Apply for the Spring 2026 Pilot
            </Link>
            <p className="text-xs text-white/40 mt-4">
              No credit card - Invite-only - One business day response
            </p>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </>
  );
}
