import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Phone,
  FileText,
  MessageSquare,
  BarChart3,
  RefreshCw,
  BookOpen,
  Users,
  Camera,
  Video,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  Building2,
  Stethoscope,
  Scale,
  Briefcase,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Features - 8 Engines That Turn Conversations Into Work",
  description:
    "Explore Inkra's 8 core engines: Conversation Capture, Auto-Documentation, Conversation Guides, Reports & Goals, Program Tracking, Knowledge System, Workforce Intelligence, and IRL-to-Digital. AI case notes software with automated form filling. HIPAA compliant. SOC2 ready.",
  keywords: [
    // Primary SEO targets
    "AI case notes software",
    "automated form filling",
    "conversation to compliance reports",
    // Feature-specific
    "conversation to work platform features",
    "AI documentation automation",
    "auto-generated case notes",
    "SOAP notes automation",
    "DAP notes generator",
    "grant report automation",
    "real-time conversation guides",
    "compliance reporting software",
    "program tracking software",
    "knowledge management AI",
    "workforce analytics",
    // Integration keywords
    "VoIP transcription",
    "Zoom meeting transcription",
    "Google Meet integration",
    "Microsoft Teams integration",
    // Industry keywords
    "HIPAA compliant documentation",
    "nonprofit case management software",
    "healthcare documentation AI",
    "sales conversation intelligence",
    "social worker case notes",
    "CHW documentation tool",
    // Comparison keywords
    "Otter alternative for case notes",
    "Gong alternative for nonprofits",
    "ambient documentation software",
  ],
  openGraph: {
    title: "Inkra Features - 8 Engines That Turn Conversations Into Work",
    description:
      "One conversation input. Eight engines. Unlimited outputs. AI case notes, automated form filling, conversation to compliance reports, and more.",
    images: [
      {
        url: "/og_imgs/features.png",
        width: 1200,
        height: 630,
        alt: "Inkra Features - 8 Core Engines",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inkra Features - AI Case Notes & Automated Documentation",
    description:
      "8 engines that turn conversations into case notes, forms, tasks, and compliance reports automatically.",
    images: ["/og_imgs/features.png"],
  },
  alternates: {
    canonical: "/features",
  },
};

// JSON-LD structured data for features page - ItemList schema
function FeaturesItemListJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Inkra Platform Features",
    description:
      "8 AI-powered engines that turn conversations into structured work automatically",
    numberOfItems: 8,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Conversation Capture",
        description:
          "Multi-channel capture from VoIP calls, Zoom, Google Meet, Teams, and photo uploads for offline sessions",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Auto-Documentation",
        description:
          "AI-generated case notes, SOAP records, intake forms, PRDs, and meeting summaries from conversations",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Conversation Guides",
        description:
          "Real-time prompts, checklists, and context surfaced during live calls to ensure nothing is missed",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Reports & Goals",
        description:
          "Automated grant reports, KPI dashboards, and pipeline reviews with alerts when targets are hit",
      },
      {
        "@type": "ListItem",
        position: 5,
        name: "Program Tracking",
        description:
          "Multi-session treatments, training programs, and client journeys tracked across conversations",
      },
      {
        "@type": "ListItem",
        position: 6,
        name: "Knowledge System",
        description:
          "Policies, workflows, and SOPs captured from practice and pushed org-wide instantly",
      },
      {
        "@type": "ListItem",
        position: 7,
        name: "Workforce Intelligence",
        description:
          "Team performance visibility and training recommendations from efficiency data",
      },
      {
        "@type": "ListItem",
        position: 8,
        name: "IRL-to-Digital",
        description:
          "Photo-based attendance capture and paper form digitization for offline or device-free sessions",
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

// JSON-LD SoftwareApplication schema for rich snippets
function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Inkra",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    description:
      "AI case notes software that turns conversations into documentation, forms, tasks, and compliance reports automatically. Features automated form filling, conversation to compliance reports, and multi-channel capture.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/PreOrder",
      description: "Spring 2026 Pilot Program - Apply for early access",
    },
    featureList: [
      "AI case notes software - SOAP, DAP, and narrative formats",
      "Automated form filling from conversation extraction",
      "Conversation to compliance reports (WIOA, TANF, grants)",
      "Multi-channel capture: VoIP, Zoom, Google Meet, Teams",
      "Real-time conversation guides and prompts",
      "Program tracking across multiple sessions",
      "Knowledge system for institutional memory",
      "Workforce intelligence and analytics",
      "IRL-to-digital via photo capture",
      "HIPAA compliant with full audit trail",
    ],
    screenshot: "https://inkra.ai/og_imgs/features.png",
    softwareRequirements: "Modern web browser",
    permissions: "Microphone access for call capture",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const engines: Array<{
  id: string;
  icon: typeof Phone;
  title: string;
  tagline: string;
  description: string;
  benefits: string[];
  useCases: string[];
  color: "blue" | "green" | "amber";
}> = [
  {
    id: "conversation-capture",
    icon: Phone,
    title: "Conversation Capture",
    tagline: "Every channel. One inbox.",
    description:
      "Capture conversations from any source: VoIP phone calls, Zoom meetings, Google Meet, Microsoft Teams, or in-person sessions. No internet? Snap a photo of handwritten notes or attendance sheets.",
    benefits: [
      "Built-in VoIP phone system with custom numbers",
      "One-click integration with Zoom, Meet, and Teams",
      "Photo upload for paper-based sessions",
      "Automatic speaker identification",
    ],
    useCases: [
      "Case managers conducting client calls via VoIP",
      "Sales teams capturing Zoom discovery calls",
      "Healthcare providers in telehealth sessions",
      "Support agents on customer service calls",
    ],
    color: "blue",
  },
  {
    id: "auto-documentation",
    icon: FileText,
    title: "Auto-Documentation",
    tagline: "Generated, not typed.",
    description:
      "Every conversation becomes structured documentation. AI case notes software that actually works. SOAP records populate automatically. Intake forms fill from what was said via automated form filling. PRDs emerge from product discussions.",
    benefits: [
      "Industry-specific formats (SOAP, DAP, narrative)",
      "Custom form templates with field extraction",
      "Confidence scores for AI-populated fields",
      "One-click human review and approval",
    ],
    useCases: [
      "Social workers generating SOAP notes after client sessions",
      "Intake coordinators with automated form filling",
      "Clinicians documenting patient encounters",
      "UX researchers creating interview summaries",
    ],
    color: "green",
  },
  {
    id: "conversation-guides",
    icon: MessageSquare,
    title: "Conversation Guides",
    tagline: "Never miss what matters.",
    description:
      "Real-time prompts surface during live calls. Checklists ensure compliance requirements are covered. Key details from previous sessions appear when you need them. Context follows the conversation.",
    benefits: [
      "Dynamic prompts based on conversation flow",
      "Compliance checklists for regulated industries",
      "Previous session context auto-surfaced",
      "Custom guide templates per conversation type",
    ],
    useCases: [
      "New case managers following intake protocols",
      "Sales reps on discovery calls with prospect context",
      "Support agents with customer history at fingertips",
      "Therapists tracking treatment plan progress",
    ],
    color: "amber",
  },
  {
    id: "reports-goals",
    icon: BarChart3,
    title: "Reports & Goals",
    tagline: "Metrics that compile themselves.",
    description:
      "Grant reports generate from real data, not memory. Conversation to compliance reports happens automatically. KPI dashboards update from every conversation. Pipeline reviews reflect actual activity. Alerts fire when targets are hit or missed.",
    benefits: [
      "Grant-ready reports (WIOA, TANF, custom)",
      "Real-time KPI dashboards",
      "Goal tracking with automated alerts",
      "Narrative generation for funders",
    ],
    useCases: [
      "Program directors compiling quarterly funder reports",
      "Sales managers tracking pipeline velocity",
      "Nonprofit executives monitoring service outcomes",
      "Grant writers pulling impact narratives",
    ],
    color: "blue",
  },
  {
    id: "program-tracking",
    icon: RefreshCw,
    title: "Program Tracking",
    tagline: "Session 4 knows sessions 1-3.",
    description:
      "Multi-session treatments, training programs, and client journeys track automatically across conversations. Progress compounds. Compliance requirements satisfy themselves. Nothing falls through the cracks.",
    benefits: [
      "Multi-session treatment tracking",
      "Program completion monitoring",
      "Milestone and checkpoint automation",
      "Cross-session pattern recognition",
    ],
    useCases: [
      "Reentry programs tracking participant milestones",
      "Physical therapists monitoring patient progress",
      "Training coordinators following employee development",
      "Substance abuse counselors tracking recovery journeys",
    ],
    color: "green",
  },
  {
    id: "knowledge-system",
    icon: BookOpen,
    title: "Knowledge System",
    tagline: "Institutional memory that stays.",
    description:
      "Policies, workflows, and SOPs capture from practice. When the best employee leaves, their knowledge doesn't. Updates push org-wide instantly. The right answer surfaces when it's needed.",
    benefits: [
      "Automatic knowledge capture from conversations",
      "Searchable institutional memory",
      "Real-time policy distribution",
      "Best practice identification",
    ],
    useCases: [
      "Onboarding new case managers with tribal knowledge",
      "Support teams with updated policy answers",
      "Multi-location operations sharing best practices",
      "Legal teams maintaining matter context",
    ],
    color: "amber",
  },
  {
    id: "workforce-intelligence",
    icon: Users,
    title: "Workforce Intelligence",
    tagline: "See without asking.",
    description:
      "Team performance visible without status meetings. Training recommendations emerge from efficiency data. Workload distribution balanced automatically. Burnout signals detected early.",
    benefits: [
      "Team performance dashboards",
      "Automated training recommendations",
      "Workload distribution insights",
      "Early warning indicators",
    ],
    useCases: [
      "Program managers balancing caseloads",
      "Sales directors identifying coaching opportunities",
      "HR tracking team capacity and burnout risk",
      "Operations leads optimizing staffing",
    ],
    color: "blue",
  },
  {
    id: "irl-to-digital",
    icon: Camera,
    title: "IRL-to-Digital",
    tagline: "Paper in. Data out.",
    description:
      "No devices allowed in session? No internet in the field? Print attendance sheets, snap a photo after. Handwritten forms digitize automatically. Everything syncs when connectivity returns.",
    benefits: [
      "Photo-based attendance capture",
      "Handwriting recognition",
      "Offline-first mobile support",
      "Automatic sync on reconnect",
    ],
    useCases: [
      "Group sessions where devices aren't allowed",
      "Field workers in areas without connectivity",
      "Classrooms capturing attendance sheets",
      "Community health workers in rural settings",
    ],
    color: "green",
  },
];

const integrations = [
  {
    name: "VoIP Phone",
    description: "Built-in phone system",
    icon: Phone,
    included: true,
  },
  {
    name: "Zoom",
    description: "Meeting integration",
    icon: Video,
    included: true,
  },
  {
    name: "Google Meet",
    description: "Meeting integration",
    icon: Video,
    included: true,
  },
  {
    name: "Microsoft Teams",
    description: "Meeting integration",
    icon: Video,
    included: true,
  },
];

export default function FeaturesPage() {
  return (
    <>
      <FeaturesItemListJsonLd />
      <SoftwareApplicationJsonLd />

      <div className="min-h-screen bg-[var(--paper)]">
        {/* Navigation */}
        <MarketingNav currentPath="/features" />

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6 relative overflow-hidden">
          {/* Background pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--ink-blue) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="max-w-4xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-blue-accent)] bg-[var(--ink-blue-wash)] px-4 py-2 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-blue-accent)]" />
              Platform Features
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal leading-tight tracking-tight mb-6">
              Eight engines.
              <br />
              <em className="text-[var(--ink-blue-accent)]">One conversation.</em>
            </h1>

            <p className="text-lg text-[var(--ink-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
              Inkra turns every conversation into documentation, reports, tasks,
              knowledge, context, and insights. Here's how each engine works.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/#cta"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--ink-blue)] text-white text-base font-semibold rounded-xl hover:bg-[var(--ink-blue-mid)] transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-lg"
              >
                Join the Spring 2026 Pilot
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#engines"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-medium text-[var(--ink-muted)] border border-[var(--border)] rounded-xl hover:border-[var(--ink-blue-accent)] hover:text-[var(--ink-blue-accent)] transition-all duration-200"
              >
                Explore all features
              </Link>
            </div>
          </div>
        </section>

        {/* Trust indicators */}
        <div className="border-t border-b border-[var(--border-light)] py-5">
          <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8">
            {[
              { icon: Shield, label: "HIPAA Compliant" },
              { icon: Shield, label: "End-to-End Encrypted" },
              { icon: Shield, label: "Your Data Never Trains Models" },
              { icon: Clock, label: "Full Audit Trail" },
            ].map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-green)]" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Engines Grid */}
        <section id="engines" className="py-20 px-6 scroll-mt-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] mb-4 block">
                The Platform
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight mb-4">
                Every engine works together.
                <br />
                <em className="text-[var(--ink-blue-accent)]">One input powers all.</em>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {engines.map((engine, index) => {
                const Icon = engine.icon;
                const colorMap: Record<typeof engine.color, { bg: string; text: string; border: string }> = {
                  blue: {
                    bg: "bg-[var(--ink-blue-wash)]",
                    text: "text-[var(--ink-blue-accent)]",
                    border: "border-[var(--ink-blue-accent)]",
                  },
                  green: {
                    bg: "bg-[var(--ink-green-wash)]",
                    text: "text-[var(--ink-green)]",
                    border: "border-[var(--ink-green)]",
                  },
                  amber: {
                    bg: "bg-[var(--ink-amber-wash)]",
                    text: "text-[var(--ink-amber)]",
                    border: "border-[var(--ink-amber)]",
                  },
                };
                const colorStyles = colorMap[engine.color];

                return (
                  <div
                    key={engine.id}
                    id={engine.id}
                    className="group p-8 bg-[var(--paper)] border border-[var(--border-light)] rounded-2xl hover:border-[var(--border)] transition-all duration-300 scroll-mt-24"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl ${colorStyles.bg} flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-6 h-6 ${colorStyles.text}`} />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                          Engine {index + 1}
                        </span>
                        <h3 className="font-serif text-xl font-normal mt-1">
                          {engine.title}
                        </h3>
                      </div>
                    </div>

                    <p className={`text-sm font-semibold ${colorStyles.text} mb-3`}>
                      {engine.tagline}
                    </p>

                    <p className="text-sm text-[var(--ink-muted)] leading-relaxed mb-6">
                      {engine.description}
                    </p>

                    <div className="mb-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-3">
                        Key Benefits
                      </h4>
                      <ul className="space-y-2">
                        {engine.benefits.map((benefit, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-[var(--ink-soft)]"
                          >
                            <CheckCircle2
                              className={`w-4 h-4 ${colorStyles.text} flex-shrink-0 mt-0.5`}
                            />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-[var(--border-light)]">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-3">
                        Use Cases
                      </h4>
                      <ul className="space-y-1.5">
                        {engine.useCases.map((useCase, i) => (
                          <li
                            key={i}
                            className="text-xs text-[var(--ink-muted)] pl-3 border-l-2 border-[var(--border-light)]"
                          >
                            {useCase}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How They Work Together */}
        <section className="py-20 px-6 bg-[var(--paper-warm)]">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] mb-4 block">
              How It Works
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight mb-12">
              One conversation.
              <br />
              <em className="text-[var(--ink-blue-accent)]">Six automatic outputs.</em>
            </h2>

            <div className="grid sm:grid-cols-3 gap-px bg-[var(--border-light)] rounded-2xl overflow-hidden">
              {[
                {
                  step: "01",
                  title: "Talk",
                  description:
                    "Your team has conversations via phone, video, or in-person.",
                },
                {
                  step: "02",
                  title: "Generate",
                  description:
                    "Documentation, reports, and tasks create automatically.",
                },
                {
                  step: "03",
                  title: "Compound",
                  description:
                    "Knowledge builds. Patterns emerge. The org gets smarter.",
                },
              ].map((item) => (
                <div key={item.step} className="bg-[var(--paper)] p-8">
                  <span className="text-xs font-semibold text-[var(--ink-blue-accent)] tracking-wide">
                    {item.step}
                  </span>
                  <h3 className="font-serif text-xl mt-3 mb-2">{item.title}</h3>
                  <p className="text-sm text-[var(--ink-muted)]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mid-page CTA */}
        <section className="py-16 px-6 bg-[var(--ink-blue)] text-white relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 16px)",
            }}
          />
          <div className="max-w-3xl mx-auto text-center relative">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal leading-tight mb-4">
              See how these engines work
              <br />
              <em>for your team.</em>
            </h2>
            <p className="text-sm opacity-70 mb-6 max-w-lg mx-auto">
              20 founding organizations get priority pricing, white-glove onboarding,
              and direct roadmap input.
            </p>
            <Link
              href="/#cta"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--ink-blue)] text-sm font-semibold rounded-lg hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
            >
              Apply for the Spring 2026 Pilot
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Industries Section */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] mb-4 block">
                Built For
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight mb-4">
                If your team runs on conversations,
                <br />
                <em className="text-[var(--ink-blue-accent)]">Inkra runs for you.</em>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: Building2,
                  title: "Nonprofits",
                  description: "Case management, grant reporting, intake automation",
                  link: "/use-cases/nonprofits",
                },
                {
                  icon: Stethoscope,
                  title: "Healthcare",
                  description: "SOAP notes, patient documentation, telehealth",
                  link: "/use-cases/healthcare",
                },
                {
                  icon: Briefcase,
                  title: "Sales",
                  description: "CRM automation, pipeline tracking, call intelligence",
                  link: "/use-cases/sales",
                },
                {
                  icon: Scale,
                  title: "Legal",
                  description: "Matter tracking, billable capture, client notes",
                  link: "#",
                },
              ].map((industry) => {
                const Icon = industry.icon;
                return (
                  <Link
                    key={industry.title}
                    href={industry.link}
                    className="group p-6 border border-[var(--border-light)] rounded-xl hover:border-[var(--ink-blue-accent)] hover:bg-[var(--ink-blue-ghost)] transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4 group-hover:bg-[var(--ink-blue-accent)] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5 text-[var(--ink-blue-accent)] group-hover:text-white" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{industry.title}</h3>
                    <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                      {industry.description}
                    </p>
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {[
                "UX Research",
                "Product Teams",
                "People Management",
                "Customer Support",
                "Real Estate",
                "Multi-Location Ops",
              ].map((industry) => (
                <span
                  key={industry}
                  className="text-xs font-medium text-[var(--ink-muted)] px-3 py-1.5 border border-[var(--border)] rounded-full"
                >
                  {industry}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section className="py-20 px-6 bg-[var(--paper-warm)]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-muted)] mb-4 block">
                Integrations
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight mb-4">
                Works where you work.
                <br />
                <em className="text-[var(--ink-blue-accent)]">Every channel covered.</em>
              </h2>
              <p className="text-[var(--ink-muted)] max-w-xl mx-auto">
                Built-in VoIP plus seamless integration with your existing video
                conferencing tools. One platform captures everything.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div
                    key={integration.name}
                    className="p-6 bg-[var(--paper)] border border-[var(--border-light)] rounded-xl text-center hover:border-[var(--border)] transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--ink-blue-wash)] flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-[var(--ink-blue-accent)]" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{integration.name}</h3>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {integration.description}
                    </p>
                    {integration.included && (
                      <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[var(--ink-green)]">
                        <Zap className="w-3 h-3" />
                        Included
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-center text-sm text-[var(--ink-muted)] mt-8">
              More integrations coming: Salesforce, HubSpot, Epic, Cerner, custom
              EHR/CRM connectors
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-4 gap-px bg-[var(--border-light)] rounded-2xl overflow-hidden">
              {[
                { value: "40-60%", label: "less documentation time" },
                { value: "6+", label: "outputs per conversation" },
                { value: "< 1 min", label: "to review and approve" },
                { value: "100%", label: "audit trail coverage" },
              ].map((stat, i) => (
                <div key={i} className="bg-[var(--paper)] p-8 text-center">
                  <div className="font-serif text-3xl text-[var(--ink-blue-accent)] mb-2">
                    {stat.value}
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 bg-[var(--ink-blue)] text-white relative overflow-hidden">
          {/* Background pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="max-w-2xl mx-auto text-center relative">
            <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-tight mb-4">
              Ready to see Inkra
              <br />
              <em>in action?</em>
            </h2>
            <p className="text-base opacity-70 mb-8 leading-relaxed">
              20 founding organizations get priority pricing, white-glove onboarding,
              and direct roadmap input.
            </p>
            <Link
              href="/#cta"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[var(--ink-blue)] text-base font-semibold rounded-xl hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200"
            >
              Apply for the Spring 2026 Pilot
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs opacity-40 mt-4">
              No credit card required. Invite-only. One business day response.
            </p>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </>
  );
}
