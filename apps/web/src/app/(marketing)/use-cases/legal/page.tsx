import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Legal Services - Client Intake & Matter Documentation",
  description:
    "Every client call indexed and searchable. Inkra auto-captures client conversations, builds matter timelines, tracks billable time, and prepares trial-ready documentation. ABA compliant.",
  keywords: [
    "legal intake automation",
    "law firm documentation AI",
    "client interview transcription legal",
    "matter management automation",
    "legal billing software",
    "attorney documentation AI",
    "law practice management",
    "client intake software",
    "legal transcription service",
    "deposition transcript AI",
    "trial preparation software",
    "attorney time tracking",
    "legal document automation",
    "case management software",
  ],
  openGraph: {
    title: "Legal Services - Client Intake & Documentation | Inkra",
    description:
      "Every client call indexed and searchable. Auto-capture conversations, track billable time, and prepare trial-ready documentation.",
    images: [
      {
        url: "/og_imgs/use-case-legal.png",
        width: 1200,
        height: 630,
        alt: "Inkra for Legal Services - Client Intake Automation",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases/legal",
  },
};

// Industry-specific JSON-LD
function LegalJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Inkra for Legal Services",
    description:
      "AI-powered legal documentation that auto-captures client conversations, builds matter timelines, tracks billable time, and organizes facts for trial preparation.",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Inkra for Legal",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Legal Practice Management Software",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "Client call transcription and indexing",
        "Matter timeline auto-generation",
        "Billable time capture",
        "Key fact extraction and tagging",
        "Cross-matter search",
        "Trial preparation summaries",
        "Attorney-client privilege protection",
        "Secure end-to-end encryption",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "Attorneys, lawyers, paralegals, legal assistants, law firm administrators",
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
          name: "Legal",
          item: "https://inkra.ai/use-cases/legal",
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
    title: "Every Call Indexed & Searchable",
    description:
      "Client mentioned a key detail in call 3 of 12? Find it instantly. Every conversation is transcribed, tagged, and searchable across all matters. No more digging through scattered notes.",
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
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    title: "Matter Timelines Auto-Build",
    description:
      "Key dates, facts, and events extracted from client calls automatically. Timeline builds itself as you work the case. Trial prep starts organized, not scrambled.",
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
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
  },
  {
    title: "Billable Time Captured Accurately",
    description:
      "Stop reconstructing call lengths from memory. Every client conversation is timed and logged. Your biller gets accurate documentation. No revenue left on the table.",
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
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: "Trial Prep in Hours, Not Days",
    description:
      "Preparing for trial? Pull every relevant conversation moment across months of calls instantly. Key facts summarized. Contradictions flagged. Witness prep materials ready.",
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
          d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
        />
      </svg>
    ),
  },
];

const features = [
  {
    category: "Documentation",
    items: [
      "Client call transcription with timestamps",
      "Key fact extraction and tagging",
      "Matter timeline auto-generation",
      "Witness statement summaries",
    ],
  },
  {
    category: "Billing & Time",
    items: [
      "Automatic time tracking per call",
      "Billable activity documentation",
      "Time entry narrative generation",
      "Export to billing systems",
    ],
  },
  {
    category: "Case Management",
    items: [
      "Cross-matter search",
      "Conflict of interest flagging",
      "Deadline and statute tracking",
      "Team collaboration and notes",
    ],
  },
];

export default function LegalPage() {
  return (
    <>
      <LegalJsonLd />

      <main className="min-h-screen bg-[var(--paper)]">
        {/* Nav */}
        <MarketingNav currentPath="/use-cases/legal" />

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
              <span className="text-[var(--ink)]">Legal</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--ink-blue-accent)]" />
              Legal Services
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Every client call.
              <br />
              <em className="text-[var(--ink-blue-accent)]">Instantly searchable.</em>
            </h1>

            <p className="text-xl text-[var(--ink-muted)] max-w-2xl mb-8">
              Attorney Kim has 40 active matters. Each client call surfaces new
              facts. Inkra indexes every conversation, builds matter timelines,
              and captures billable time - so trial prep takes hours, not days.
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
                Attorney-Client Privilege
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                SOC2 Type II
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                End-to-End Encrypted
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                Full Audit Trail
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
              Bill 6 hours.
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                Spend 2 more documenting.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  40+
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  active matters with scattered notes across months
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  2 hrs
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  daily spent on documentation after client work
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  15%
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  of billable time lost to incomplete tracking
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  Days
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  searching through notes before trial prep
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
                organized case files.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="border border-[var(--border-light)] rounded-2xl p-8"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] flex items-center justify-center mb-6">
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
                  From client call to{" "}
                  <em className="text-[var(--ink-blue-accent)]">
                    trial-ready documentation
                  </em>
                </h2>
                <p className="text-[var(--ink-muted)] mb-6">
                  Matter documented automatically. Key facts extracted and
                  indexed. Billable time logged. Timeline updated with new
                  information from every call.
                </p>
                <ul className="space-y-3">
                  {[
                    "12 client calls fully indexed",
                    "24 key facts extracted and tagged",
                    "18.5 billable hours captured",
                    "Matter timeline auto-generated",
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
                    MK
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Chen v. Apex</div>
                    <div className="text-xs text-[var(--ink-muted)]">
                      12 calls - Trial in 30d
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Key facts
                    </span>
                    <span className="text-sm font-medium">24 indexed</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Billable captured
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-green-wash)] text-[var(--ink-green)]">
                      18.5 hrs
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Timeline
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)]">
                      Auto-generated
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Last update
                    </span>
                    <span className="text-sm font-medium">Yesterday</span>
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
                legal workflows
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

        {/* Security Section */}
        <section className="px-8 py-16 bg-[var(--paper-warm)]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              Security & Compliance
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-8">
              Attorney-client privilege{" "}
              <em className="text-[var(--ink-blue-accent)]">
                is non-negotiable.
              </em>
            </h2>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ),
                  title: "End-to-End Encrypted",
                  desc: "AES-256 encryption at rest and in transit",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  ),
                  title: "Full Audit Trail",
                  desc: "Every access logged with immutable chain",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  ),
                  title: "Access Controls",
                  desc: "Matter-level permissions and role-based access",
                },
                {
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                  ),
                  title: "SOC2 Type II",
                  desc: "Annual third-party security audits",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6"
                >
                  <div className="text-[var(--ink-blue-accent)] mb-4 flex justify-center">{item.icon}</div>
                  <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-[var(--ink-muted)]">{item.desc}</p>
                </div>
              ))}
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
                href="/use-cases/ux-research"
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
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    UX Research
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)]">
                    User interview analysis and insights
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
              Ready to find any detail
              <br />
              <em>instantly?</em>
            </h2>
            <p className="text-white/70 mb-8">
              Join law firms piloting client documentation that indexes every
              conversation and captures every billable minute.
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

        {/* Footer */}
        <MarketingFooter />
      </main>
    </>
  );
}
