import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Sales & Account Management - Conversation Intelligence",
  description:
    "Never lose relationship context again. Inkra captures every call detail, syncs to CRM, and enables seamless handoffs. Protect $2M+ in pipeline per rep transition.",
  keywords: [
    "sales conversation intelligence",
    "CRM conversation sync",
    "sales call recording AI",
    "relationship intelligence software",
    "pipeline handoff automation",
    "Salesforce call integration",
    "HubSpot conversation AI",
    "sales documentation automation",
    "account management AI",
    "sales enablement software",
    "Gong alternative",
    "Chorus alternative",
    "sales AI automation",
  ],
  openGraph: {
    title: "Sales & Account Management | Inkra",
    description:
      "Conversation intelligence that captures relationships, syncs to CRM, and enables seamless handoffs.",
    images: [
      {
        url: "/og_imgs/use-case-sales.png",
        width: 1200,
        height: 630,
        alt: "Inkra for Sales - Conversation Intelligence",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases/sales",
  },
};

// Industry-specific JSON-LD
function SalesJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Inkra for Sales & Account Management",
    description:
      "Conversation intelligence that captures relationship details, syncs to CRM automatically, and enables seamless rep handoffs with complete context.",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Inkra for Sales",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Sales Intelligence Software",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "Auto-sync to Salesforce, HubSpot, Pipedrive",
        "Relationship intelligence capture",
        "Deal stage tracking from conversations",
        "Personal detail extraction",
        "Org chart and stakeholder mapping",
        "Handoff continuity reports",
        "Pipeline intelligence dashboard",
        "Budget and timing signals",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "Sales representatives, account executives, account managers, sales leaders, revenue operations",
      },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://inkra.ai",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Use Cases",
          item: "https://inkra.ai/use-cases",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Sales",
          item: "https://inkra.ai/use-cases/sales",
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

const benefits = [
  {
    title: "Relationships That Transfer",
    description:
      "When Jordan gets promoted, his prospect relationships shouldn't go cold. Inkra captures the personal details, rapport builders, and context that make deals close.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  {
    title: "CRM That Updates Itself",
    description:
      "Stop asking reps to log calls. Inkra listens, extracts the key info, and pushes to Salesforce, HubSpot, or Pipedrive automatically. Deal stage, next steps, stakeholders - all captured.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
        />
      </svg>
    ),
  },
  {
    title: "Pipeline Intelligence",
    description:
      "Know which deals are actually moving before the weekly forecast. Inkra tracks buying signals, objections, and competitor mentions across all calls - not just what reps remember to log.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    title: "Seamless Handoffs",
    description:
      "Rep leaving? Territory change? Generate a complete handoff report: relationship history, deal context, personal notes, and suggested next steps. The new rep starts with context, not cold outreach.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    ),
  },
];

const features = [
  {
    category: "CRM Integration",
    items: [
      "Salesforce bi-directional sync",
      "HubSpot activity logging",
      "Pipedrive deal updates",
      "Custom field mapping",
    ],
  },
  {
    category: "Relationship Capture",
    items: [
      "Personal details and rapport builders",
      "Org chart and stakeholder mapping",
      "Decision maker identification",
      "Budget and timing signals",
    ],
  },
  {
    category: "Pipeline Intelligence",
    items: [
      "Deal stage inference from calls",
      "Objection and competitor tracking",
      "Buying signal detection",
      "Risk alerts for stalled deals",
    ],
  },
];

export default function SalesPage() {
  return (
    <>
      <SalesJsonLd />

      <MarketingNav currentPath="/use-cases/sales" />
      <main className="min-h-screen bg-[var(--paper)]">

        {/* Hero */}
        <section className="pt-32 pb-16 px-8">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[var(--ink-muted)] mb-8">
              <Link
                href="/use-cases"
                className="hover:text-[var(--ink-blue-accent)]"
              >
                Use Cases
              </Link>
              <span>/</span>
              <span className="text-[var(--ink)]">Sales</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ink-amber-wash)] text-[var(--ink-amber)] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--ink-amber)]" />
              Sales & Account Management
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Never lose
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                relationship context
              </em>
              <br />
              again.
            </h1>

            <p className="text-xl text-[var(--ink-muted)] max-w-2xl mb-8">
              Your top rep closes because they remember the little things. When
              they move on, that knowledge shouldn&apos;t walk out the door.
              Inkra captures every conversation detail and makes handoffs
              seamless.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-12">
              <Link
                href="/#cta"
                className="px-8 py-4 bg-[var(--ink-blue)] text-white font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                Apply for the Pilot
              </Link>
              <Link
                href="#features"
                className="px-6 py-4 text-[var(--ink-muted)] border border-[var(--border)] rounded-xl hover:border-[var(--ink-blue-accent)] hover:text-[var(--ink-blue-accent)] transition-all"
              >
                See All Features
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                Salesforce Integrated
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                HubSpot Connected
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                SOC2 Certified
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                End-to-End Encrypted
              </span>
            </div>
          </div>
        </section>

        {/* Pain Points */}
        <section className="px-8 py-16 bg-[var(--paper-warm)]">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              The problem
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-8">
              Rep gets promoted.
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                $2M in pipeline goes cold.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  $2M+
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  pipeline at risk with every rep transition
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  60%
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  of CRM data is incomplete or outdated
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  5 hrs
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  per week reps spend on CRM data entry
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  90 days
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  for new reps to rebuild territory relationships
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-8 py-20">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              The solution
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-12">
              Conversations become{" "}
              <em className="text-[var(--ink-blue-accent)]">
                living relationships.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="border border-[var(--border-light)] rounded-2xl p-8"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--ink-amber-wash)] text-[var(--ink-amber)] flex items-center justify-center mb-6">
                    {benefit.icon}
                  </div>
                  <h3 className="font-serif text-xl font-normal mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Visual Demo */}
        <section className="px-8 py-16 bg-[var(--paper-dim)]">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
                  Example output
                </p>
                <h2 className="font-serif text-3xl font-normal mb-6">
                  From call to{" "}
                  <em className="text-[var(--ink-blue-accent)]">
                    complete contact record
                  </em>
                </h2>
                <p className="text-[var(--ink-muted)] mb-6">
                  Sales call captured and analyzed. Contact enriched with
                  personal details, deal stage updated, next action scheduled -
                  all without the rep touching Salesforce.
                </p>
                <ul className="space-y-3">
                  {[
                    "Personal note: Maya in Little League playoffs",
                    "Deal stage moved to Proposal Sent",
                    "Decision timeline: Q2 budget cycle",
                    "Follow-up scheduled for Thursday",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-sm text-[var(--ink-soft)]"
                    >
                      <span className="text-[var(--ink-green)]">
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
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mockup */}
              <div className="bg-[var(--paper)] border border-[var(--border)] rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] flex items-center justify-center font-semibold text-sm">
                    DC
                  </div>
                  <div>
                    <div className="font-semibold text-sm">David Chen</div>
                    <div className="text-xs text-[var(--ink-muted)]">
                      VP Eng - Acme Corp
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Last call
                    </span>
                    <span className="text-sm font-medium">2 days ago</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Deal stage
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)]">
                      Proposal sent
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Personal note
                    </span>
                    <span className="text-xs font-medium">
                      Maya: Little League
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Next action
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-green-wash)] text-[var(--ink-green)]">
                      Follow up Thu
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-8 py-20">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              Features
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-12">
              Built for{" "}
              <em className="text-[var(--ink-blue-accent)]">
                revenue teams
              </em>
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((category, i) => (
                <div key={i}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-4">
                    {category.category}
                  </h3>
                  <ul className="space-y-3">
                    {category.items.map((item, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-3 text-sm text-[var(--ink-soft)]"
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
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How Handoffs Work */}
        <section className="px-8 py-20 bg-[var(--paper-warm)]">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              Handoff continuity
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-12">
              Rep transition?{" "}
              <em className="text-[var(--ink-blue-accent)]">
                Relationship stays.
              </em>
            </h2>

            <div className="grid md:grid-cols-3 gap-0">
              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-l-2xl p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-amber)] mb-4">
                  01 - CAPTURE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Every call builds history
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Personal details, decision drivers, objections, timing - all
                  extracted automatically. No manual logging required.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-amber)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-amber)] mb-4">
                  02 - GENERATE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Handoff report created
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Complete relationship history, deal context, rapport builders,
                  and suggested next steps - all in one document.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-amber)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-r-2xl p-8">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-amber)] mb-4">
                  03 - CONTINUE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  New rep starts with context
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  First call isn&apos;t cold. The prospect feels remembered.
                  Deal momentum maintained. Pipeline protected.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cross-links */}
        <section className="px-8 py-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-8 text-center">
              Explore other industries
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/use-cases/nonprofits"
                className="group flex items-center gap-6 p-6 border border-[var(--border-light)] rounded-2xl hover:border-[var(--ink-blue-accent)] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--ink-green-wash)] text-[var(--ink-green)] flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
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
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    Nonprofits & Social Services
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)]">
                    Case management and grant reporting
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-[var(--ink-muted)] group-hover:text-[var(--ink-blue-accent)] group-hover:translate-x-1 transition-all"
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
              </Link>

              <Link
                href="/use-cases/healthcare"
                className="group flex items-center gap-6 p-6 border border-[var(--border-light)] rounded-2xl hover:border-[var(--ink-blue-accent)] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
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
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    Healthcare & Community Health
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)]">
                    HIPAA-compliant ambient documentation
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-[var(--ink-muted)] group-hover:text-[var(--ink-blue-accent)] group-hover:translate-x-1 transition-all"
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
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
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
              Ready to protect
              <br />
              <em>your pipeline?</em>
            </h2>
            <p className="text-white/70 mb-8">
              Join sales teams piloting conversation intelligence that actually
              updates CRM and enables seamless handoffs.
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
