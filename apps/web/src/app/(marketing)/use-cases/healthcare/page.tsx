import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Healthcare & Community Health - Ambient Documentation",
  description:
    "HIPAA-compliant ambient documentation for CHWs and clinicians. Auto-generate SOAP notes, extract billing codes, and track treatment plans across sessions. Save 90 minutes daily.",
  keywords: [
    "ambient clinical documentation",
    "HIPAA compliant transcription",
    "community health worker software",
    "CHW documentation automation",
    "AI SOAP notes",
    "medical documentation AI",
    "healthcare transcription HIPAA",
    "clinical note automation",
    "billing code extraction",
    "CPT code automation",
    "treatment plan tracking",
    "patient visit documentation",
    "healthcare ambient AI",
    "Abridge alternative",
    "Nuance alternative",
  ],
  openGraph: {
    title: "Healthcare & Community Health | Inkra",
    description:
      "HIPAA-compliant ambient documentation. Auto-generate SOAP notes and billing docs from patient visits.",
    images: [
      {
        url: "/og_imgs/use-case-healthcare.png",
        width: 1200,
        height: 630,
        alt: "Inkra for Healthcare - Ambient Documentation",
      },
    ],
  },
  alternates: {
    canonical: "/use-cases/healthcare",
  },
};

// Industry-specific JSON-LD
function HealthcareJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Inkra for Healthcare & Community Health Workers",
    description:
      "HIPAA-compliant ambient documentation that auto-generates SOAP notes, extracts billing codes, and tracks treatment plans across patient visits.",
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Inkra for Healthcare",
      applicationCategory: "HealthApplication",
      applicationSubCategory: "Clinical Documentation Software",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
      },
      featureList: [
        "HIPAA-compliant ambient documentation",
        "Auto-generated SOAP notes",
        "DAP and narrative note formats",
        "CPT and ICD-10 code extraction",
        "Multi-session treatment tracking",
        "Progress tracking with metrics",
        "Secure end-to-end encryption",
        "Full audit trail",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "Community health workers, clinicians, therapists, physical therapists, primary care providers",
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
          name: "Healthcare",
          item: "https://inkra.ai/use-cases/healthcare",
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
    title: "90 Minutes Saved Daily",
    description:
      "Clinicians spend hours after shifts writing notes. Inkra generates documentation during visits, so you can go home on time - or see more patients.",
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
    title: "SOAP Notes That Write Themselves",
    description:
      "Subjective, Objective, Assessment, Plan - all extracted automatically from your conversation. Supports DAP and narrative formats too. Review and sign off in seconds.",
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
    title: "Billing Codes Ready at Checkout",
    description:
      "CPT and ICD-10 codes extracted from conversations. Your biller gets accurate documentation before the patient leaves. Every visit becomes billable revenue.",
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
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
        />
      </svg>
    ),
  },
  {
    title: "Treatment Tracking Across Sessions",
    description:
      "Patient returns for session 4 of 6. You see their full history: initial presentation, progress metrics, what worked, what didn't. Continuity without chart review.",
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
];

const features = [
  {
    category: "Clinical Notes",
    items: [
      "SOAP notes auto-generated from visits",
      "DAP format for behavioral health",
      "Progress notes with outcome tracking",
      "Chief complaint extraction",
    ],
  },
  {
    category: "Billing & Compliance",
    items: [
      "CPT code suggestions from conversations",
      "ICD-10 diagnosis code extraction",
      "Time tracking for billing accuracy",
      "HIPAA-compliant storage and access",
    ],
  },
  {
    category: "Care Continuity",
    items: [
      "Multi-session treatment plans",
      "Progress metrics across visits",
      "Patient history at a glance",
      "Care team handoff documentation",
    ],
  },
];

export default function HealthcarePage() {
  return (
    <>
      <HealthcareJsonLd />

      <main className="min-h-screen bg-[var(--paper)]">
        {/* Nav */}
        <MarketingNav currentPath="/use-cases/healthcare" />

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
              <span className="text-[var(--ink)]">Healthcare</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--ink-blue-accent)]" />
              Healthcare & Community Health
            </div>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Document while you
              <br />
              <em className="text-[var(--ink-blue-accent)]">care.</em>
              <br />
              Not after.
            </h1>

            <p className="text-xl text-[var(--ink-muted)] max-w-2xl mb-8">
              CHWs and clinicians spend 90+ minutes daily on notes. Inkra
              listens to visits, generates SOAP notes, extracts billing codes,
              and tracks treatment plans - all HIPAA compliant.
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
                HIPAA Compliant
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
              Patients leave at 5pm.
              <br />
              <em className="text-[var(--ink-blue-accent)]">
                You leave at 7pm.
              </em>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  90 min
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  daily spent on documentation after clinic hours
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  25%
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  of visit time spent typing instead of listening
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  $150K+
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  in missed billable time per provider per year
                </p>
              </div>
              <div className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6">
                <div className="font-serif text-4xl text-[var(--ink-blue-accent)] mb-2">
                  Session 4
                </div>
                <p className="text-sm text-[var(--ink-muted)]">
                  and you can&apos;t remember sessions 1-3
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
              Ambient documentation{" "}
              <em className="text-[var(--ink-blue-accent)]">
                that captures everything.
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
                  From visit to{" "}
                  <em className="text-[var(--ink-blue-accent)]">
                    signed note in minutes
                  </em>
                </h2>
                <p className="text-[var(--ink-muted)] mb-6">
                  Physical therapy session documented automatically. SOAP note
                  generated, billing codes extracted, progress tracked against
                  previous sessions.
                </p>
                <ul className="space-y-3">
                  {[
                    "Session captured ambientaly",
                    "SOAP note generated in real-time",
                    "CPT codes 97110, 97140 extracted",
                    "Progress: +15 degrees since session 1",
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
                    SM
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Sarah M.</div>
                    <div className="text-xs text-[var(--ink-muted)]">
                      Session 4 of 6 - PT
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      SOAP note
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-green-wash)] text-[var(--ink-green)]">
                      Generated
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Billing codes
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)]">
                      97110, 97140
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Mobility
                    </span>
                    <span className="text-sm font-medium">+15 since S1</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--border-light)]">
                    <span className="text-sm text-[var(--ink-muted)]">
                      Next session
                    </span>
                    <span className="text-sm font-medium">March 4</span>
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
                clinical workflows
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
              HIPAA isn&apos;t a feature.{" "}
              <em className="text-[var(--ink-blue-accent)]">
                It&apos;s the foundation.
              </em>
            </h2>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  icon: "🔒",
                  title: "End-to-End Encrypted",
                  desc: "AES-256 encryption at rest and in transit",
                },
                {
                  icon: "📋",
                  title: "Full Audit Trail",
                  desc: "Every access logged with immutable chain",
                },
                {
                  icon: "🏥",
                  title: "BAA Ready",
                  desc: "Business Associate Agreement included",
                },
                {
                  icon: "🛡️",
                  title: "SOC2 Type II",
                  desc: "Annual third-party security audits",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl p-6"
                >
                  <div className="text-3xl mb-4">{item.icon}</div>
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
              Ready to go home
              <br />
              <em>on time?</em>
            </h2>
            <p className="text-white/70 mb-8">
              Join healthcare providers piloting ambient documentation that
              actually works for clinical workflows.
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
