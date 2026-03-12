import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "UX Research - User Interview Analysis & Insights",
  description:
    "Be present in interviews, not stuck taking notes. Inkra auto-captures user interviews, generates notes in your template, and surfaces cross-interview patterns. 90 minutes saved per interview.",
  keywords: [
    "UX research interview software",
    "user interview analysis AI",
    "research synthesis automation",
    "user testing documentation",
    "qualitative research AI",
    "interview transcription UX",
    "research notes automation",
    "user research insights",
    "product research tools",
    "Dovetail alternative",
    "Condens alternative",
    "user interview recording",
    "research repository software",
    "cross-interview pattern analysis",
  ],
  openGraph: {
    title: "UX Research - User Interview Analysis | Inkra",
    description:
      "Be present in interviews, not stuck taking notes. Auto-capture interviews and surface cross-interview patterns.",
    images: [
      {
        url: "/og_imgs/use-case-ux-research.png",
        width: 1200,
        height: 630,
        alt: "Inkra for UX Research - Interview Analysis",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases/ux-research",
  },
};

// Industry-specific JSON-LD
function UXResearchJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Inkra for UX Research",
    description:
      "AI-powered user interview analysis that auto-captures conversations, generates research notes, and surfaces cross-interview patterns automatically.",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Inkra for UX Research",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "User Research Software",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "Auto-generated interview notes in custom templates",
        "Cross-interview pattern detection",
        "Research synthesis automation",
        "Quote and insight tagging",
        "PRD input auto-population",
        "Research repository search",
        "Participant tracking",
        "Team sharing and collaboration",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "UX researchers, product managers, design researchers, user experience designers, product designers",
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
          name: "UX Research",
          item: "https://inkra.ai/use-cases/ux-research",
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
    title: "Be Present, Not Distracted",
    description:
      "The best insights come when you stop taking notes and start listening. Inkra captures everything so you can focus on follow-up questions and building rapport with participants.",
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
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    title: "Notes in Your Template",
    description:
      "Interview notes auto-generate in whatever format you use - Jobs to be Done, affinity mapping prep, or custom templates. Review and refine in minutes, not hours.",
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
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    title: "Patterns Surface Automatically",
    description:
      "\"5/8 users mentioned onboarding friction.\" Inkra tracks themes across interviews and surfaces patterns you might miss when synthesizing manually.",
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
          d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
        />
      </svg>
    ),
  },
  {
    title: "PRD Input Ready",
    description:
      "Findings flow directly into product requirements. Link insights to specific features, track evidence strength, and share user voice with stakeholders who weren't in the room.",
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
          d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
];

const features = [
  {
    category: "Interview Capture",
    items: [
      "Full interview transcription with timestamps",
      "Speaker identification and labeling",
      "Key quote extraction and tagging",
      "Video and audio recording support",
    ],
  },
  {
    category: "Research Synthesis",
    items: [
      "Cross-interview pattern detection",
      "Theme clustering and affinity mapping",
      "Insight strength scoring",
      "Contradiction and outlier flagging",
    ],
  },
  {
    category: "Team Collaboration",
    items: [
      "Searchable research repository",
      "Shareable insight reports",
      "PRD and spec integration",
      "Stakeholder presentation exports",
    ],
  },
];

export default function UXResearchPage() {
  return (
    <>
      <UXResearchJsonLd />

      <MarketingNav currentPath="/use-cases/ux-research" />
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
              <span className="text-[var(--ink)]">UX Research</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--ink-blue-accent)]" />
              UX Research
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Stop taking notes.
              <br />
              <em className="text-[var(--ink-blue-accent)]">Start listening.</em>
            </h1>

            <p className="text-xl text-[var(--ink-muted)] max-w-2xl mb-8">
              Your best insights come when you&apos;re fully present in the
              conversation. Inkra captures every interview, generates notes in
              your template, and surfaces patterns across participants
              automatically.
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
                Zoom & Meet Integration
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                SOC2 Certified
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                Participant Privacy
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                Team Sharing
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
              45 minutes interviewing.
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                90 minutes reconstructing.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  2x
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  the interview length spent on notes and synthesis
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  30%
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  of interview details lost in manual note-taking
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  8+ hrs
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  per research round synthesizing across interviews
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  Missed
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  follow-up questions while typing the last answer
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
              Interviews in.{" "}
              <em className="text-[var(--ink-blue-accent)]">
                Insights out.
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
                  From interview to{" "}
                  <em className="text-[var(--ink-blue-accent)]">
                    actionable insights
                  </em>
                </h2>
                <p className="text-[var(--ink-muted)] mb-6">
                  Discovery interview captured and analyzed. Key insights
                  extracted, patterns linked to previous interviews, and
                  findings connected to your PRD automatically.
                </p>
                <ul className="space-y-3">
                  {[
                    "42-minute interview fully transcribed",
                    "Key insight: Onboarding friction",
                    "Pattern match: 5/8 users mentioned same issue",
                    "PRD link: Feature request auto-created",
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
                    U7
                  </div>
                  <div>
                    <div className="font-semibold text-sm">User #7</div>
                    <div className="text-xs text-[var(--ink-muted)]">
                      Discovery Interview
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Duration
                    </span>
                    <span className="text-sm font-medium">42 min</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Key insight
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)]">
                      Onboarding friction
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Pattern match
                    </span>
                    <span className="text-sm font-medium">5/8 users</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      PRD updated
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-green-wash)] text-[var(--ink-green)]">
                      Auto-linked
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
                research workflows
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

        {/* How It Works */}
        <section className="px-8 py-20 bg-[var(--paper-warm)]">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-muted)] mb-4">
              How it works
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-normal mb-12">
              From interview to{" "}
              <em className="text-[var(--ink-blue-accent)]">
                product insight
              </em>
            </h2>

            <div className="grid md:grid-cols-3 gap-0">
              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-l-2xl p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  01 - INTERVIEW
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Have the conversation
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Run your interview on Zoom, Meet, or phone. Inkra captures
                  everything. You focus on the participant, not your notepad.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-blue-accent)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  02 - ANALYZE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Notes generate automatically
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Interview notes appear in your template. Key quotes tagged.
                  Patterns linked to previous interviews. Review and refine in
                  minutes.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-blue-accent)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-r-2xl p-8">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  03 - SYNTHESIZE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Patterns surface across rounds
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Cross-interview insights emerge automatically. Share findings
                  with stakeholders. Feed validated needs into PRDs.
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
                href="/use-cases/sales"
                className="group flex items-center gap-6 p-6 border border-[var(--border-light)] rounded-2xl hover:border-[var(--ink-blue-accent)] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--ink-amber-wash)] text-[var(--ink-amber)] flex items-center justify-center">
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
                      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    Sales & Account Management
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)]">
                    Relationship capture and CRM sync
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
                href="/use-cases/legal"
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
                      d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg group-hover:text-[var(--ink-blue-accent)] transition-colors">
                    Legal Services
                  </h3>
                  <p className="text-sm text-[var(--ink-muted)]">
                    Client intake and matter documentation
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
              Ready to be present
              <br />
              <em>in your interviews?</em>
            </h2>
            <p className="text-white/70 mb-8">
              Join research teams piloting interview analysis that captures
              everything and surfaces patterns automatically.
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
