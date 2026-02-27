"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, HelpCircle, MessageCircle, Users, Building2, Sparkles } from "lucide-react";
import { FAQJsonLd } from "@/components/seo/json-ld";

// Pricing FAQ content for SEO
const pricingFAQs = [
  {
    question: "How does conversation intelligence pricing typically work?",
    answer:
      "Conversation intelligence platforms like Inkra typically use seat-based pricing with usage allowances. Each plan includes a set number of conversation hours per seat per month. Enterprise plans often include unlimited usage and custom integrations. Inkra is currently offering pilot pricing for early adopters joining the Spring 2026 program.",
  },
  {
    question: "What is nonprofit documentation software and how much does it cost?",
    answer:
      "Nonprofit documentation software automates case notes, intake forms, and compliance reporting for organizations like social services agencies and community health programs. Costs vary widely from $15-150 per user per month depending on features. Inkra offers special nonprofit pricing during our pilot program—apply to learn more.",
  },
  {
    question: "Is there a free trial for Inkra?",
    answer:
      "Yes. Pilot program participants receive extended trial periods, priority onboarding, and direct input on the product roadmap. Apply for the Spring 2026 pilot to get started with a personalized demo and trial.",
  },
  {
    question: "What's included in Inkra's pilot program?",
    answer:
      "Pilot program members receive founding pricing (locked in for life), white-glove onboarding with dedicated support, direct access to the product team, and influence over the feature roadmap. We're accepting 20 organizations for the Spring 2026 cohort.",
  },
  {
    question: "Does Inkra offer volume discounts?",
    answer:
      "Yes. Organizations with 10+ seats qualify for volume pricing. Enterprise organizations with custom requirements receive tailored pricing including unlimited usage, custom integrations, and dedicated support. Contact us to discuss your organization's needs.",
  },
  {
    question: "What compliance features are included?",
    answer:
      "All Inkra plans include SOC2 compliance and end-to-end encryption. HIPAA compliance, extended audit logging, and grant reporting features (WIOA, TANF) are available for organizations that need them. We'll help you select the right configuration during your pilot application.",
  },
  {
    question: "Can I switch plans or cancel anytime?",
    answer:
      "Yes. All plans are month-to-month with no long-term contracts required. You can upgrade, downgrade, or cancel at any time. Changes take effect at the start of your next billing cycle.",
  },
];

// Feature comparison data for the table
const featureCategories = {
  capture: {
    label: "Conversation Capture",
    features: [
      { name: "VoIP phone calls (built-in)", included: true },
      { name: "Zoom integration", included: true },
      { name: "Google Meet integration", included: true },
      { name: "Microsoft Teams integration", included: true },
      { name: "Mobile app recording", included: true },
      { name: "Photo upload (attendance sheets, paper forms)", included: true },
      { name: "Audio file upload", included: true },
    ],
  },
  documentation: {
    label: "Auto-Documentation",
    features: [
      { name: "AI-generated case notes", included: true },
      { name: "Multiple note formats (SOAP, DAP, narrative)", included: true },
      { name: "Custom form auto-fill", included: true },
      { name: "Task & follow-up generation", included: true },
      { name: "Calendar event creation", included: true },
      { name: "Custom form builder", included: true },
      { name: "Industry-specific templates", included: true },
    ],
  },
  reporting: {
    label: "Reporting & Analytics",
    features: [
      { name: "Analytics dashboard", included: true },
      { name: "Grant report templates", included: true },
      { name: "WIOA/TANF compliance reports", included: true },
      { name: "Custom report builder", included: true },
      { name: "Goal tracking & alerts", included: true },
      { name: "Cross-location analytics", included: true },
      { name: "Data export (CSV, PDF)", included: true },
    ],
  },
  security: {
    label: "Security & Compliance",
    features: [
      { name: "End-to-end encryption", included: true },
      { name: "SOC2 compliance", included: true },
      { name: "HIPAA compliance (configurable)", included: true },
      { name: "Immutable audit logging", included: true },
      { name: "Role-based access control", included: true },
      { name: "SSO/SAML authentication", included: true },
      { name: "Data residency options", included: true },
    ],
  },
  support: {
    label: "Support & Services",
    features: [
      { name: "Email & chat support", included: true },
      { name: "Onboarding & training", included: true },
      { name: "API access", included: true },
      { name: "Custom integrations (EHR, CRM)", included: true },
      { name: "Dedicated success manager", included: true },
      { name: "Custom SLA options", included: true },
      { name: "On-premise deployment", included: true },
    ],
  },
};

export default function PricingPage() {
  useEffect(() => {
    // Scroll reveal animation
    const revealElements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
    );
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* SEO: FAQPage Structured Data */}
      <FAQJsonLd questions={pricingFAQs} />

      <style jsx global>{`
        :root {
          --paper: #fafaf8;
          --paper-warm: #f5f4f0;
          --paper-dim: #eeedea;
          --ink: #111111;
          --ink-soft: #3a3a3a;
          --ink-muted: #6b6b6b;
          --ink-faint: #a1a1a1;
          --border: #dadad7;
          --border-light: #e8e8e5;
          --ink-blue: #1b2a4a;
          --ink-blue-accent: #2b4c8c;
          --ink-blue-mid: #244280;
          --ink-blue-wash: rgba(43, 76, 140, 0.08);
          --ink-blue-ghost: rgba(43, 76, 140, 0.04);
          --ink-red: #b34747;
          --ink-green: #3f6f5a;
          --ink-amber: #b26a00;
          --sans: "Soehne", var(--font-inter), -apple-system, system-ui,
            sans-serif;
          --serif: "Tiempos Text", Georgia, serif;
          --display: "Soehne Breit", "Soehne", var(--font-inter), sans-serif;
          --ease: cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dark {
          --paper: #0f1014;
          --paper-warm: #151619;
          --paper-dim: #1c1d22;
          --ink: #e8e8e5;
          --ink-soft: #c4c4c0;
          --ink-muted: #8a8a86;
          --ink-faint: #6e6e6b;
          --border: #3a3b42;
          --border-light: #2f3034;
          --ink-blue: #3d5a94;
          --ink-blue-accent: #a8b8d8;
          --ink-blue-mid: #344f88;
          --ink-blue-wash: rgba(138, 158, 200, 0.1);
          --ink-blue-ghost: rgba(138, 158, 200, 0.05);
          --ink-red: #e07070;
          --ink-green: #6baa90;
          --ink-amber: #d4a24c;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html {
          scroll-behavior: smooth;
        }
        body {
          font-family: var(--sans);
          font-weight: 300;
          background: var(--paper);
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        /* NAV */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: color-mix(in srgb, var(--paper) 80%, transparent);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid
            color-mix(in srgb, var(--border) 50%, transparent);
        }
        .nav-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-mark {
          display: flex;
          align-items: center;
        }
        .nav-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .nav-link {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
          text-decoration: none;
          transition: color 0.2s var(--ease);
        }
        .nav-link:hover {
          color: var(--ink-blue-accent);
        }
        .nav-cta {
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 600;
          padding: 10px 20px;
          background: var(--ink-blue);
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s var(--ease);
          text-decoration: none;
        }
        .nav-cta:hover {
          background: var(--ink-blue-mid);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(27, 42, 74, 0.2);
        }

        /* HERO */
        .hero {
          padding: 160px 32px 80px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle,
            var(--ink-blue) 1px,
            transparent 1px
          );
          background-size: 24px 24px;
          opacity: 0.03;
          pointer-events: none;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-blue-accent);
          background: var(--ink-blue-wash);
          padding: 8px 16px;
          border-radius: 999px;
          margin-bottom: 24px;
          animation: fadeUp 0.8s var(--ease) both;
        }
        .hero h1 {
          font-family: var(--serif);
          font-weight: 400;
          font-size: clamp(36px, 5vw, 56px);
          line-height: 1.15;
          letter-spacing: -0.02em;
          max-width: 720px;
          margin: 0 auto 20px;
          animation: fadeUp 0.8s 0.1s var(--ease) both;
        }
        .hero h1 em {
          font-style: italic;
          color: var(--ink-blue-accent);
        }
        .hero-sub {
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-muted);
          max-width: 560px;
          margin: 0 auto 40px;
          animation: fadeUp 0.8s 0.2s var(--ease) both;
        }

        /* PILOT CTA SECTION */
        .pilot-section {
          padding: 0 32px 80px;
        }
        .pilot-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          max-width: 1000px;
          margin: 0 auto;
        }
        .pilot-card {
          background: var(--paper);
          border: 1px solid var(--border-light);
          border-radius: 20px;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all 0.3s var(--ease);
        }
        .pilot-card:hover {
          border-color: var(--ink-blue-accent);
          box-shadow: 0 8px 32px rgba(43, 76, 140, 0.08);
        }
        .pilot-card.featured {
          background: var(--ink-blue);
          color: #fff;
          border-color: var(--ink-blue);
        }
        .pilot-card.featured:hover {
          box-shadow: 0 8px 32px rgba(27, 42, 74, 0.3);
        }
        .pilot-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: var(--ink-blue-wash);
          display: grid;
          place-items: center;
          margin-bottom: 24px;
        }
        .pilot-card.featured .pilot-icon {
          background: rgba(255, 255, 255, 0.15);
        }
        .pilot-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 8px;
        }
        .pilot-card.featured .pilot-label {
          color: rgba(255, 255, 255, 0.6);
        }
        .pilot-title {
          font-family: var(--serif);
          font-size: 28px;
          font-weight: 400;
          margin-bottom: 12px;
        }
        .pilot-desc {
          font-size: 15px;
          color: var(--ink-muted);
          line-height: 1.6;
          margin-bottom: 32px;
          flex: 1;
        }
        .pilot-card.featured .pilot-desc {
          color: rgba(255, 255, 255, 0.7);
        }
        .pilot-benefits {
          list-style: none;
          margin-bottom: 32px;
        }
        .pilot-benefit {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 14px;
          color: var(--ink-soft);
          padding: 10px 0;
          border-top: 1px solid var(--border-light);
        }
        .pilot-card.featured .pilot-benefit {
          color: rgba(255, 255, 255, 0.85);
          border-top-color: rgba(255, 255, 255, 0.15);
        }
        .pilot-benefit svg {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .pilot-cta {
          font-family: var(--sans);
          font-size: 15px;
          font-weight: 600;
          padding: 16px 28px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s var(--ease);
          text-align: center;
          text-decoration: none;
          display: block;
        }
        .pilot-cta.primary {
          background: var(--ink-blue);
          color: #fff;
          border: none;
        }
        .pilot-cta.primary:hover {
          background: var(--ink-blue-mid);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(27, 42, 74, 0.2);
        }
        .pilot-card.featured .pilot-cta.primary {
          background: #fff;
          color: var(--ink-blue);
        }
        .pilot-card.featured .pilot-cta.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .pilot-cta.secondary {
          background: none;
          color: var(--ink-muted);
          border: 1px solid var(--border);
        }
        .pilot-cta.secondary:hover {
          border-color: var(--ink-blue-accent);
          color: var(--ink-blue-accent);
        }
        .pilot-note {
          font-size: 12px;
          color: var(--ink-faint);
          margin-top: 12px;
          text-align: center;
        }
        .pilot-card.featured .pilot-note {
          color: rgba(255, 255, 255, 0.5);
        }

        /* VALUE PROPS */
        .value-section {
          padding: 60px 32px 80px;
          background: var(--paper-warm);
        }
        .value-inner {
          max-width: 1000px;
          margin: 0 auto;
          text-align: center;
        }
        .value-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-top: 48px;
        }
        .value-item {
          text-align: left;
          padding: 32px;
          background: var(--paper);
          border-radius: 16px;
          border: 1px solid var(--border-light);
        }
        .value-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--ink-blue-wash);
          display: grid;
          place-items: center;
          margin-bottom: 20px;
        }
        .value-title {
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 400;
          margin-bottom: 8px;
        }
        .value-desc {
          font-size: 14px;
          color: var(--ink-muted);
          line-height: 1.6;
        }

        /* FEATURE COMPARISON */
        .comparison-section {
          padding: 80px 32px;
        }
        .comparison-inner {
          max-width: 800px;
          margin: 0 auto;
        }
        .section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 16px;
          text-align: center;
        }
        .section-title {
          font-family: var(--serif);
          font-weight: 400;
          font-size: clamp(28px, 4vw, 40px);
          line-height: 1.2;
          letter-spacing: -0.015em;
          margin-bottom: 48px;
          text-align: center;
        }
        .section-title em {
          font-style: italic;
          color: var(--ink-blue-accent);
        }
        .feature-category {
          margin-bottom: 32px;
        }
        .feature-category-header {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-blue-accent);
          background: var(--ink-blue-ghost);
          padding: 12px 20px;
          border-radius: 10px 10px 0 0;
        }
        .feature-list {
          border: 1px solid var(--border-light);
          border-top: none;
          border-radius: 0 0 10px 10px;
          background: var(--paper);
          overflow: hidden;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          font-size: 14px;
          color: var(--ink-soft);
          border-bottom: 1px solid var(--border-light);
        }
        .feature-item:last-child {
          border-bottom: none;
        }
        .feature-item svg {
          flex-shrink: 0;
        }

        /* FAQ SECTION */
        .faq-section {
          padding: 80px 32px;
          background: var(--paper-warm);
        }
        .faq-inner {
          max-width: 720px;
          margin: 0 auto;
        }
        .faq-list {
          margin-top: 40px;
        }
        .faq-item {
          border-bottom: 1px solid var(--border-light);
          background: var(--paper);
        }
        .faq-item:first-child {
          border-radius: 12px 12px 0 0;
        }
        .faq-item:last-child {
          border-radius: 0 0 12px 12px;
          border-bottom: none;
        }
        .faq-question {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 24px;
          cursor: pointer;
          font-family: var(--serif);
          font-size: 17px;
          font-weight: 400;
          color: var(--ink);
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          transition: color 0.2s var(--ease);
        }
        .faq-question:hover {
          color: var(--ink-blue-accent);
        }
        .faq-question svg {
          flex-shrink: 0;
          color: var(--ink-muted);
          transition: transform 0.3s var(--ease);
        }
        .faq-item.open .faq-question svg {
          transform: rotate(180deg);
        }
        .faq-answer {
          font-size: 15px;
          color: var(--ink-muted);
          line-height: 1.7;
          padding: 0 24px 24px;
          display: none;
        }
        .faq-item.open .faq-answer {
          display: block;
        }

        /* CTA SECTION */
        .cta-section {
          padding: 100px 32px;
          background: var(--ink-blue);
          color: #fff;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .cta-section::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.04) 1px,
            transparent 1px
          );
          background-size: 20px 20px;
          pointer-events: none;
        }
        .cta-inner {
          max-width: 600px;
          margin: 0 auto;
          position: relative;
        }
        .cta-section h2 {
          font-family: var(--serif);
          font-size: clamp(32px, 4vw, 44px);
          font-weight: 400;
          line-height: 1.2;
          margin-bottom: 16px;
        }
        .cta-section h2 em {
          font-style: italic;
        }
        .cta-section p {
          font-size: 17px;
          opacity: 0.75;
          margin-bottom: 36px;
          line-height: 1.6;
        }
        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn-white {
          font-family: var(--sans);
          font-size: 15px;
          font-weight: 600;
          padding: 16px 32px;
          background: #fff;
          color: var(--ink-blue);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s var(--ease);
          text-decoration: none;
          display: inline-block;
        }
        .btn-white:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .btn-ghost-white {
          font-family: var(--sans);
          font-size: 15px;
          font-weight: 500;
          padding: 16px 32px;
          background: transparent;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s var(--ease);
          text-decoration: none;
          display: inline-block;
        }
        .btn-ghost-white:hover {
          border-color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.1);
        }
        .cta-note {
          font-size: 13px;
          opacity: 0.5;
          margin-top: 16px;
        }

        /* FOOTER */
        footer {
          padding: 40px 32px;
          border-top: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        footer .foot-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        footer .foot-name {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.03em;
        }
        footer .foot-links {
          display: flex;
          gap: 20px;
        }
        footer a {
          font-size: 13px;
          color: var(--ink-muted);
          text-decoration: none;
        }
        footer a:hover {
          color: var(--ink-blue-accent);
        }
        footer .foot-copy {
          font-size: 12px;
          color: var(--ink-faint);
        }

        /* ANIMATIONS */
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .pilot-grid {
            grid-template-columns: 1fr;
          }
          .value-grid {
            grid-template-columns: 1fr;
          }
          .nav-links {
            display: none;
          }
        }
        @media (max-width: 520px) {
          .hero {
            padding: 140px 20px 60px;
          }
          .pilot-section,
          .comparison-section,
          .faq-section,
          .value-section {
            padding-left: 20px;
            padding-right: 20px;
          }
          .pilot-card {
            padding: 32px 24px;
          }
          .cta-buttons {
            flex-direction: column;
          }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-left" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="nav-mark">
            <Image
              src="/inkra-logo.svg"
              alt="Inkra"
              width={48}
              height={14}
              priority
            />
          </div>
          <span className="nav-name">Inkra</span>
        </Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">
            How it works
          </Link>
          <Link href="/pricing" className="nav-link" style={{ color: "var(--ink-blue-accent)" }}>
            Pricing
          </Link>
        </div>
        <Link href="/#cta" className="nav-cta">
          Join the Pilot
        </Link>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">Spring 2026 Pilot Program</div>
        <h1>
          Pricing built for
          <br />
          <em>your organization.</em>
        </h1>
        <p className="hero-sub">
          We&apos;re offering founding member pricing to our Spring 2026 pilot cohort.
          Apply today to lock in your rate and get white-glove onboarding.
        </p>
      </section>

      {/* PILOT CTA */}
      <section className="pilot-section reveal">
        <div className="pilot-grid">
          {/* Pilot Program - Featured */}
          <div className="pilot-card featured">
            <div className="pilot-icon">
              <Sparkles className="w-6 h-6" style={{ color: "#fff" }} />
            </div>
            <div className="pilot-label">Limited Availability</div>
            <h3 className="pilot-title">Pilot Program</h3>
            <p className="pilot-desc">
              Join 20 founding organizations getting early access, priority pricing,
              and direct influence on the product roadmap.
            </p>
            <ul className="pilot-benefits">
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "#6BAA90" }} />
                <span>Founding member pricing locked in for life</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "#6BAA90" }} />
                <span>White-glove onboarding & dedicated support</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "#6BAA90" }} />
                <span>Direct access to product team & roadmap input</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "#6BAA90" }} />
                <span>All features included during pilot period</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "#6BAA90" }} />
                <span>Extended trial with no commitment</span>
              </li>
            </ul>
            <Link href="/#cta" className="pilot-cta primary">
              Apply for the Pilot Program
            </Link>
            <p className="pilot-note">20 spots remaining · Reviewed weekly</p>
          </div>

          {/* Enterprise */}
          <div className="pilot-card">
            <div className="pilot-icon">
              <Building2 className="w-6 h-6" style={{ color: "var(--ink-blue-accent)" }} />
            </div>
            <div className="pilot-label">For Large Organizations</div>
            <h3 className="pilot-title">Enterprise</h3>
            <p className="pilot-desc">
              Custom deployment, integrations, and support for organizations
              with complex requirements.
            </p>
            <ul className="pilot-benefits">
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                <span>Custom integrations (EHR, CRM, case management)</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                <span>SSO/SAML authentication</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                <span>Dedicated success manager</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                <span>Custom SLA & priority support</span>
              </li>
              <li className="pilot-benefit">
                <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                <span>On-premise deployment option</span>
              </li>
            </ul>
            <a
              href="mailto:enterprise@inkra.ai?subject=Enterprise%20Inquiry"
              className="pilot-cta secondary"
            >
              Contact Sales
            </a>
            <p className="pilot-note">Volume discounts available</p>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="value-section">
        <div className="value-inner reveal">
          <div className="section-label">Why join the pilot?</div>
          <h2 className="section-title">
            Shape the future of
            <br />
            <em>conversation automation.</em>
          </h2>

          <div className="value-grid">
            <div className="value-item">
              <div className="value-icon">
                <Users className="w-6 h-6" style={{ color: "var(--ink-blue-accent)" }} />
              </div>
              <h3 className="value-title">Founding Pricing</h3>
              <p className="value-desc">
                Lock in your rate before general availability. Pilot members get permanent
                discounted pricing that never increases.
              </p>
            </div>

            <div className="value-item">
              <div className="value-icon">
                <MessageCircle className="w-6 h-6" style={{ color: "var(--ink-blue-accent)" }} />
              </div>
              <h3 className="value-title">Direct Input</h3>
              <p className="value-desc">
                Weekly calls with the product team. Your workflows and feedback directly
                influence what we build next.
              </p>
            </div>

            <div className="value-item">
              <div className="value-icon">
                <Sparkles className="w-6 h-6" style={{ color: "var(--ink-blue-accent)" }} />
              </div>
              <h3 className="value-title">Priority Support</h3>
              <p className="value-desc">
                White-glove onboarding, dedicated slack channel, and 4-hour response time
                during the pilot period.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE COMPARISON */}
      <section className="comparison-section">
        <div className="comparison-inner reveal">
          <div className="section-label">What&apos;s included</div>
          <h2 className="section-title">
            One platform.
            <br />
            <em>Everything you need.</em>
          </h2>

          {Object.entries(featureCategories).map(([key, category]) => (
            <div key={key} className="feature-category">
              <div className="feature-category-header">{category.label}</div>
              <div className="feature-list">
                {category.features.map((feature, index) => (
                  <div key={index} className="feature-item">
                    <Check className="w-5 h-5" style={{ color: "var(--ink-green)" }} />
                    <span>{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="faq-inner reveal">
          <div className="section-label">Common questions</div>
          <h2 className="section-title">
            Pricing &
            <br />
            <em>frequently asked questions.</em>
          </h2>

          <div className="faq-list">
            {pricingFAQs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="cta">
        <div className="cta-inner reveal">
          <h2>
            Ready to automate
            <br />
            <em>documentation?</em>
          </h2>
          <p>
            Join the Spring 2026 pilot and discover how Inkra can save your team
            hours every week on documentation, reporting, and compliance.
          </p>
          <div className="cta-buttons">
            <Link href="/#cta" className="btn-white">
              Apply for the Pilot
            </Link>
            <a
              href="mailto:hello@inkra.ai?subject=Pricing%20Question"
              className="btn-ghost-white"
            >
              Ask a Question
            </a>
          </div>
          <div className="cta-note">
            No credit card required · One business day response
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="foot-left">
          <span className="foot-name">Inkra</span>
          <span className="foot-copy">© 2026 Inkra · Phoenixing LLC</span>
        </div>
        <div className="foot-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Security</a>
          <a href="mailto:hello@inkra.ai">Contact</a>
        </div>
      </footer>
    </>
  );
}

// FAQ Item Component with toggle
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const item = e.currentTarget.closest(".faq-item");
    item?.classList.toggle("open");
  };

  return (
    <div className="faq-item">
      <button className="faq-question" onClick={handleToggle}>
        <span>{question}</span>
        <HelpCircle className="w-5 h-5" />
      </button>
      <div className="faq-answer">{answer}</div>
    </div>
  );
}
