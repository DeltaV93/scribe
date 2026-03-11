import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Nonprofits & Social Services - Documentation Automation",
  description:
    "Reduce case manager documentation time by 40-60%. Inkra auto-generates case notes, fills intake forms, and compiles grant reports from conversations. WIOA and TANF compliant.",
  keywords: [
    "nonprofit case management software",
    "AI case notes for social workers",
    "case manager documentation automation",
    "WIOA compliance software",
    "TANF reporting automation",
    "social services documentation AI",
    "automated intake forms nonprofit",
    "grant reporting software",
    "reentry services case management",
    "workforce development documentation",
    "human services AI",
    "nonprofit CRM automation",
  ],
  openGraph: {
    title: "Nonprofits & Social Services | Inkra",
    description:
      "Reduce documentation time by 40-60%. Auto-generate case notes, intake forms, and grant reports from conversations.",
    images: [
      {
        url: "/og_imgs/use-case-nonprofits.png",
        width: 1200,
        height: 630,
        alt: "Inkra for Nonprofits - Documentation Automation",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases/nonprofits",
  },
};

// Industry-specific JSON-LD
function NonprofitJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Inkra for Nonprofits & Social Services",
    description:
      "AI-powered documentation automation for case managers and social workers. Reduce documentation time by 40-60% while ensuring WIOA/TANF compliance.",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Inkra for Nonprofits",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Case Management Software",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "AI-generated case notes (SOAP, DAP, narrative formats)",
        "Automated intake form filling",
        "WIOA compliance reporting",
        "TANF eligibility documentation",
        "Grant reporting with narratives",
        "Photo-upload attendance capture",
        "Multi-organization data sharing",
        "Audit trail for compliance",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "Case managers, social workers, program directors, nonprofit administrators",
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
          name: "Nonprofits",
          item: "https://inkra.ai/use-cases/nonprofits",
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
    title: "40-60% Less Documentation Time",
    description:
      "Case managers spend 16+ hours per week on paperwork. Inkra auto-generates case notes during or immediately after calls, freeing time for direct client service.",
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
    title: "Grant Reports That Write Themselves",
    description:
      "Stop spending 20+ hours quarterly reconstructing data from memory. Inkra compiles reports with real numbers AND narratives that funders actually want to read.",
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
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
        />
      </svg>
    ),
  },
  {
    title: "WIOA & TANF Compliant Out of the Box",
    description:
      "Built-in templates for workforce development and public assistance programs. Automatic tracking of required data points, eligibility verification, and outcome documentation.",
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
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
  {
    title: "Multi-Partner Coordination",
    description:
      "Serving clients across 14+ partner organizations? Inkra standardizes data collection and enables secure sharing without re-entering information in each system.",
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
    category: "Documentation",
    items: [
      "Case notes in SOAP, DAP, or narrative format",
      "Intake forms auto-filled from conversations",
      "Progress notes generated automatically",
      "Service plans with extracted goals",
    ],
  },
  {
    category: "Compliance",
    items: [
      "WIOA Adult, Youth, and Dislocated Worker tracking",
      "TANF eligibility and outcome documentation",
      "Audit-ready activity logs with timestamps",
      "Funder-specific reporting templates",
    ],
  },
  {
    category: "Operations",
    items: [
      "Photo-upload attendance for group sessions",
      "Follow-up task generation with assignments",
      "Client journey tracking across programs",
      "Cross-organization referral management",
    ],
  },
];

export default function NonprofitsPage() {
  return (
    <>
      <NonprofitJsonLd />

      <main className="min-h-screen bg-[var(--paper)]">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between bg-[color-mix(in_srgb,var(--paper)_80%,transparent)] backdrop-blur-xl border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)]">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/inkra-logo.svg"
              alt="Inkra"
              width={48}
              height={14}
              priority
            />
            <span className="text-lg font-extrabold tracking-tight">Inkra</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/use-cases"
              className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)] transition-colors"
            >
              All Use Cases
            </Link>
            <Link
              href="/#cta"
              className="px-5 py-2.5 bg-[var(--ink-blue)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--ink-blue-mid)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Join the Pilot
            </Link>
          </div>
        </nav>

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
              <span className="text-[var(--ink)]">Nonprofits</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ink-green-wash)] text-[var(--ink-green)] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--ink-green)]" />
              Nonprofits & Social Services
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Let case managers
              <br />
              <em className="text-[var(--ink-blue-accent)]">help people.</em>
              <br />
              Not fill out forms.
            </h1>

            <p className="text-xl text-[var(--ink-muted)] max-w-2xl mb-8">
              Your team chose this work to serve people, not to spend 40% of
              their time on documentation. Inkra captures conversations and
              generates everything else automatically.
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
                WIOA Compliant
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                TANF Ready
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
              Your team does the work twice.
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                Once with clients. Once with systems.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  16 hrs
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  per week on documentation that could be automatic
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  5x
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  the same information entered into different systems
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  20+ hrs
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  quarterly compiling grant reports from memory
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  3-5x
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  paperwork duplication across partner organizations
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
              Conversations in.{" "}
              <em className="text-[var(--ink-blue-accent)]">
                Everything else out.
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

        {/* Testimonial */}
        <section className="px-8 py-16 bg-[var(--ink-blue)] text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,1) 0 1px, transparent 1px 16px)",
            }}
          />
          <div className="max-w-3xl mx-auto text-center relative">
            <blockquote className="font-serif text-2xl md:text-3xl font-normal italic leading-relaxed mb-8 opacity-95">
              &quot;This would allow us to scale. We wouldn&apos;t have to focus
              so much on our reporting side of things. It would alleviate the
              hassle. Let the people work with people.&quot;
            </blockquote>
            <div className="text-sm opacity-60">
              Karley, Director of Reentry Services - Family Assistant
            </div>
            <div className="text-xs opacity-40 mt-2">
              $30M nonprofit - 400 clients/week - 14 partner organizations
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
                nonprofit realities
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
              From call to{" "}
              <em className="text-[var(--ink-blue-accent)]">
                complete documentation
              </em>
            </h2>

            <div className="grid md:grid-cols-3 gap-0">
              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-l-2xl p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  01 - CAPTURE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Have the conversation
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Call from your desk, mobile app, or join Zoom/Meet. For group
                  sessions without devices, print an attendance sheet and snap a
                  photo after.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-blue-accent)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] p-8 md:border-r-0">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  02 - GENERATE
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Documentation writes itself
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Case notes, intake forms, service plans, and follow-up tasks
                  generate automatically. Review, adjust, and approve in
                  minutes, not hours.
                </p>
                <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--paper)] border border-[var(--border)] z-10 text-center leading-6 text-xs text-[var(--ink-blue-accent)]">
                  -
                </div>
              </div>

              <div className="relative bg-[var(--paper)] border border-[var(--border-light)] rounded-r-2xl p-8">
                <div className="text-xs font-semibold tracking-wide text-[var(--ink-blue-accent)] mb-4">
                  03 - REPORT
                </div>
                <h3 className="font-serif text-xl font-normal mb-3">
                  Reports compile from real data
                </h3>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                  Grant reports, WIOA performance data, and outcome metrics pull
                  from actual conversations. Numbers AND narratives, ready for
                  funders.
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
              Ready to give case managers
              <br />
              <em>their time back?</em>
            </h2>
            <p className="text-white/70 mb-8">
              Join 20 founding nonprofits getting priority pricing, white-glove
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

        {/* Footer */}
        <footer className="px-8 py-10 border-t border-[var(--border-light)] flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold">Inkra</span>
            <span className="text-xs text-[var(--ink-faint)]">
              2026 Inkra - Phoenixing LLC
            </span>
          </div>
          <div className="flex gap-5">
            <Link
              href="#"
              className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]"
            >
              Terms
            </Link>
            <Link
              href="#"
              className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]"
            >
              Security
            </Link>
            <Link
              href="mailto:hello@inkra.app"
              className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]"
            >
              Contact
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
