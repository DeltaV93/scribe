"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function MarketingPage() {
  const [activeStory, setActiveStory] = useState("sales");

  // Intersection Observer for reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const stories: Record<
    string,
    {
      title: string;
      scenario: React.ReactNode;
      withScrybe: string;
      mockup: { icon: string; label: string; desc: string; dims: string };
    }
  > = {
    sales: {
      title: "Your top rep closes because they remember the little things.",
      scenario: (
        <>
          Jordan remembers that his prospect&apos;s kid just started Little
          League. He brings it up on the call — the prospect lights up.
          That&apos;s not CRM data. That&apos;s{" "}
          <strong>relationship intelligence.</strong> But when Jordan gets
          promoted, <strong>$2M in pipeline goes cold overnight.</strong>
        </>
      ),
      withScrybe:
        "Every call auto-captures the Little League detail, org chart intel, and budget timing. Conversation guides remind reps what to bring up. When reps move up, the next person inherits a living relationship — not an empty record.",
      mockup: {
        icon: "📱",
        label: "Sales Story Screenshot",
        desc: 'Incoming call from "David Chen, VP Eng @ Acme" with context card: last call topics, personal note "daughter Maya — Little League playoffs next week."',
        dims: "4:3 · 900×675 · PNG",
      },
    },
    nonprofit: {
      title:
        "Your case managers chose this work to help people. Not fill out forms.",
      scenario: (
        <>
          Maria serves 400 clients weekly across 14 partner organizations. Every
          call generates paperwork — the same data,{" "}
          <strong>3–5 times.</strong> Every quarterly report: 20+ hours. And
          when staff leaves, years of client trust vanish.
        </>
      ),
      withScrybe:
        "Calls auto-document. Grant reports auto-generate with narratives, not just numbers. For group sessions where devices aren't allowed, snap a photo of an attendance sheet — AI logs all 400 clients and generates session notes.",
      mockup: {
        icon: "📱",
        label: "Nonprofit Story Screenshot",
        desc: 'Client "James Walker" with reentry milestones, program completion (Step 3/5), grant compliance dashboard at 72%.',
        dims: "4:3 · 900×675 · PNG",
      },
    },
    healthcare: {
      title:
        "Your patients come back for session 4. Do you remember sessions 1–3?",
      scenario: (
        <>
          Dr. Okafor sees 25 patients daily. Each has a multi-visit treatment
          plan. She spends <strong>90 minutes after clinic</strong> writing SOAP
          notes. Her biller waits. The front desk has{" "}
          <strong>no context when patients call between visits.</strong>
        </>
      ),
      withScrybe:
        "SOAP notes auto-generate. Treatment tracks across sessions 1–6. Billing docs ready before checkout. For group sessions in restricted facilities, photo-upload attendance handles it all.",
      mockup: {
        icon: "🏥",
        label: "Healthcare Screenshot",
        desc: 'Patient "Sarah M." — session 4/6, auto-SOAP note, billing codes ready, mobility progress chart.',
        dims: "4:3 · 900×675 · PNG",
      },
    },
    research: {
      title:
        "Your best insights come when you stop taking notes and start listening.",
      scenario: (
        <>
          Priya runs 45-minute interviews. The best moments come off-script. But
          she can&apos;t take notes AND be present. After each call:{" "}
          <strong>90 minutes reconstructing what was said.</strong>
        </>
      ),
      withScrybe:
        'Full interviews captured. Notes auto-generate in her template. Cross-interview patterns surface: "5/8 mentioned onboarding friction." PRD input forms auto-populate from findings.',
      mockup: {
        icon: "🔬",
        label: "Research Screenshot",
        desc: 'Participant "User #7" with discussion guide, live transcription, auto-tagged insights, cross-interview patterns.',
        dims: "4:3 · 900×675 · PNG",
      },
    },
    management: {
      title:
        "Your engineer mentioned wanting to learn Rust three months ago. Do you remember?",
      scenario: (
        <>
          Marcus has 8 direct reports. Promo packet time arrives and his notes
          are... sparse.{" "}
          <strong>12 hours to write a packet that still feels thin.</strong> His
          director wants a team health report — he has nothing but vibes.
        </>
      ),
      withScrybe:
        "Every 1:1 auto-documented. Promo packets write themselves from 6 months of documented growth. Reports show one team member is 30% slower — Scrybe suggests training.",
      mockup: {
        icon: "👥",
        label: "Manager Screenshot",
        desc: '"Aisha Patel, Senior Engineer" — 12 documented 1:1s, growth goals, "Generate Promo Packet" button.',
        dims: "4:3 · 900×675 · PNG",
      },
    },
    product: {
      title: "Your standup just pushed back the timeline. Does the VP know yet?",
      scenario: (
        <>
          A blocker surfaces in Tuesday&apos;s standup that pushes the launch by
          two weeks. <strong>The VP finds out on Friday.</strong> Ravi spends 4
          hours a week writing status updates that are outdated by the time he
          sends them.
        </>
      ),
      withScrybe:
        "Scrybe auto-joins standups. PRDs generate from product conversations. Timeline changes auto-push to stakeholders — the VP knows Tuesday, not Friday.",
      mockup: {
        icon: "🚀",
        label: "Product Team Screenshot",
        desc: "Auto-generated PRD with linked standup notes, auto-detected timeline change, stakeholder notification sent.",
        dims: "4:3 · 900×675 · PNG",
      },
    },
    support: {
      title:
        "Your support team follows a workflow that changed last week. Do they know?",
      scenario: (
        <>
          The refund policy changed Tuesday. Three reps gave the old policy
          Wednesday. <strong>Training takes weeks to propagate.</strong> The
          best rep&apos;s shortcuts live in her head — when she&apos;s out,
          resolution times spike 40%.
        </>
      ),
      withScrybe:
        "Knowledge system updates the moment a policy changes. Conversation guides surface the right process during calls. Best practices auto-capture from top performers and become team playbooks.",
      mockup: {
        icon: "🎧",
        label: "Support Screenshot",
        desc: "Active support call with updated refund policy flagged, suggested responses, auto-generated ticket summary.",
        dims: "4:3 · 900×675 · PNG",
      },
    },
    operations: {
      title: "Location 7 figured out intake. The other 11 don't know yet.",
      scenario: (
        <>
          Regional director overseeing 12 locations. Best practices trapped in
          one manager&apos;s head.{" "}
          <strong>
            Three weeks just getting everyone to submit data in the same format.
          </strong>
        </>
      ),
      withScrybe:
        'Scrybe captures how every location operates. Surfaces what works: "Location 7\'s intake is 40% faster." Codifies best practices into playbooks. Reports auto-generate across all locations.',
      mockup: {
        icon: "📊",
        label: "Operations Screenshot",
        desc: 'Multi-location dashboard: 12 pins, performance table, "Location 7 — 40% faster. View playbook →"',
        dims: "4:3 · 900×675 · PNG",
      },
    },
  };

  const storyTabs = [
    { id: "sales", label: "Sales" },
    { id: "nonprofit", label: "Nonprofits" },
    { id: "healthcare", label: "Healthcare" },
    { id: "research", label: "UX Research" },
    { id: "management", label: "People Managers" },
    { id: "product", label: "Product Teams" },
    { id: "support", label: "Customer Support" },
    { id: "operations", label: "Multi-Location Ops" },
  ];

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector(
      ".wl__btn"
    ) as HTMLButtonElement | null;
    if (btn) {
      btn.textContent = "You're on the list ✓";
      btn.style.background = "#3D8B6E";
      btn.disabled = true;
    }
  };

  return (
    <>
      <style jsx global>{`
        :root {
          --obsidian: #0c0c0e;
          --mid: #141416;
          --graphite: #1e1e22;
          --card: #1a1a1e;
          --copper: #c4956a;
          --copper-deep: #8a5c32;
          --bone: #ede8df;
          --muted: #6b6659;
          --white: #f8f6f2;
          --success: #3d8b6e;
          --error: #b85450;
          --serif: var(--font-serif), "Cormorant Garamond", Georgia, serif;
          --sans: var(--font-sans-brand), "Outfit", system-ui, sans-serif;
          --mono: var(--font-mono), "IBM Plex Mono", monospace;
        }

        .marketing-page * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .marketing-page {
          font-family: var(--sans);
          color: var(--obsidian);
          background: var(--bone);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        .marketing-page a {
          color: inherit;
          text-decoration: none;
        }

        .marketing-page .container {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 32px;
        }

        .marketing-page .kicker {
          font-family: var(--mono);
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--copper-deep);
        }

        @keyframes pulse {
          0%,
          100% {
            box-shadow: 0 0 6px rgba(61, 139, 110, 0.4);
          }
          50% {
            box-shadow: 0 0 14px rgba(61, 139, 110, 0.6);
          }
        }

        /* NAV */
        .marketing-page .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          height: 56px;
          display: flex;
          align-items: center;
          background: rgba(237, 232, 223, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(12, 12, 14, 0.06);
        }

        .marketing-page .nav__inner {
          max-width: 1080px;
          margin: 0 auto;
          width: 100%;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .marketing-page .nav__brand {
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--obsidian);
        }

        .marketing-page .nav__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--copper);
        }

        .marketing-page .nav__cta {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--bone);
          background: var(--copper-deep);
          padding: 7px 18px;
          border-radius: 7px;
          transition: all 0.2s;
        }

        .marketing-page .nav__cta:hover {
          background: #9a6c42;
        }

        /* BUTTONS */
        .marketing-page .btn {
          display: inline-flex;
          align-items: center;
          padding: 14px 28px;
          background: var(--copper-deep);
          color: var(--bone);
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 600;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .marketing-page .btn:hover {
          background: #9a6c42;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(138, 92, 50, 0.25);
        }

        .marketing-page .btn--outline {
          background: transparent;
          color: var(--copper-deep);
          border: 1.5px solid var(--copper-deep);
        }

        .marketing-page .btn--outline:hover {
          background: rgba(138, 92, 50, 0.06);
          box-shadow: none;
        }

        /* MOCKUP PLACEHOLDER */
        .marketing-page .mp {
          background: rgba(12, 12, 14, 0.04);
          border: 2px dashed rgba(12, 12, 14, 0.12);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 32px 20px;
        }

        .marketing-page .mp--light {
          background: rgba(12, 12, 14, 0.04);
          border-color: rgba(12, 12, 14, 0.12);
        }

        .marketing-page .mp__icon {
          font-size: 28px;
          margin-bottom: 8px;
          opacity: 0.6;
        }

        .marketing-page .mp__label {
          font-family: var(--mono);
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--copper-deep);
          margin-bottom: 5px;
        }

        .marketing-page .mp__desc {
          font-size: 11.5px;
          color: var(--muted);
          line-height: 1.5;
          max-width: 440px;
        }

        .marketing-page .mp__dims {
          font-family: var(--mono);
          font-size: 8.5px;
          color: rgba(107, 102, 89, 0.4);
          margin-top: 6px;
        }

        /* TRUST BAR */
        .marketing-page .trust {
          padding: 28px 0;
          border-top: 1px solid rgba(12, 12, 14, 0.06);
          border-bottom: 1px solid rgba(12, 12, 14, 0.06);
          background: var(--white);
        }

        .marketing-page .trust__inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
        }

        .marketing-page .trust__badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--copper-deep);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .marketing-page .trust__badge::before {
          content: "✓";
          width: 15px;
          height: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          background: rgba(138, 92, 50, 0.08);
          font-size: 8px;
          color: var(--copper-deep);
        }

        /* PAIN SECTION */
        .marketing-page .pain {
          padding: 80px 0;
          background: var(--bone);
        }

        .marketing-page .pain__header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 40px;
        }

        .marketing-page .pain__header h2 {
          font-family: var(--serif);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          line-height: 1.08;
          margin: 12px 0 0;
        }

        .marketing-page .pain__header h2 em {
          font-style: italic;
          color: var(--copper-deep);
        }

        .marketing-page .pain-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 40px;
        }

        .marketing-page .pain-card {
          padding: 24px 20px;
          border-radius: 12px;
          background: rgba(184, 84, 80, 0.03);
          border: 1px solid rgba(184, 84, 80, 0.08);
          text-align: center;
        }

        .marketing-page .pain-card__stat {
          font-family: var(--serif);
          font-size: 34px;
          font-weight: 700;
          color: var(--error);
          line-height: 1;
        }

        .marketing-page .pain-card__label {
          font-size: 12px;
          color: var(--obsidian);
          margin-top: 4px;
          line-height: 1.4;
        }

        /* HOW IT WORKS */
        .marketing-page .how {
          padding: 100px 0;
          background: var(--bone);
        }

        .marketing-page .how__header {
          text-align: center;
          max-width: 500px;
          margin: 0 auto 48px;
        }

        .marketing-page .how__header h2 {
          font-family: var(--serif);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          line-height: 1.1;
          margin: 12px 0 0;
        }

        .marketing-page .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .marketing-page .step {
          padding: 28px 24px;
          border-radius: 14px;
          background: rgba(248, 246, 242, 0.5);
          border: 1px solid rgba(12, 12, 14, 0.05);
        }

        .marketing-page .step__num {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--copper-deep);
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        .marketing-page .step h3 {
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 6px;
          line-height: 1.2;
        }

        .marketing-page .step p {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
          margin-bottom: 12px;
        }

        /* STORIES */
        .marketing-page .stories {
          padding: 100px 0;
          background: var(--white);
        }

        .marketing-page .stories__header {
          text-align: center;
          max-width: 560px;
          margin: 0 auto 48px;
        }

        .marketing-page .stories__header h2 {
          font-family: var(--serif);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          line-height: 1.08;
          margin: 12px 0 0;
          color: var(--obsidian);
        }

        .marketing-page .story-tabs {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 36px;
          flex-wrap: wrap;
        }

        .marketing-page .story-tab {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--muted);
          background: rgba(12, 12, 14, 0.04);
          border: 1px solid rgba(12, 12, 14, 0.08);
          cursor: pointer;
          transition: all 0.2s;
        }

        .marketing-page .story-tab:hover,
        .marketing-page .story-tab.active {
          color: var(--obsidian);
          border-color: var(--copper-deep);
          background: rgba(196, 149, 106, 0.08);
        }

        .marketing-page .story {
          display: none;
          animation: fadeIn 0.3s ease;
        }

        .marketing-page .story.active {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: start;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .marketing-page .story__copy h3 {
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 600;
          line-height: 1.15;
          margin-bottom: 12px;
          color: var(--obsidian);
        }

        .marketing-page .story__scenario {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.7;
          margin-bottom: 16px;
        }

        .marketing-page .story__scenario strong {
          color: var(--obsidian);
        }

        .marketing-page .story__with-scrybe {
          padding: 16px;
          border-radius: 10px;
          background: rgba(61, 139, 110, 0.06);
          border: 1px solid rgba(61, 139, 110, 0.12);
        }

        .marketing-page .story__with-label {
          font-family: var(--mono);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--success);
          margin-bottom: 6px;
        }

        .marketing-page .story__with-text {
          font-size: 13.5px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* FEATURES */
        .marketing-page .features {
          padding: 100px 0;
          background: var(--bone);
        }

        .marketing-page .features__header {
          text-align: center;
          max-width: 500px;
          margin: 0 auto 48px;
        }

        .marketing-page .features__header h2 {
          font-family: var(--serif);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          line-height: 1.1;
          margin: 12px 0 0;
          color: var(--obsidian);
        }

        .marketing-page .feat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .marketing-page .feat {
          padding: 24px 20px;
          border-radius: 12px;
          background: rgba(248, 246, 242, 0.6);
          border: 1px solid rgba(12, 12, 14, 0.06);
        }

        .marketing-page .feat__icon {
          font-size: 22px;
          margin-bottom: 10px;
        }

        .marketing-page .feat h4 {
          font-family: var(--serif);
          font-size: 17px;
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--obsidian);
        }

        .marketing-page .feat p {
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.5;
        }

        /* INDUSTRIES */
        .marketing-page .ind {
          padding: 80px 0;
          background: var(--bone);
        }

        .marketing-page .ind__header {
          text-align: center;
          margin-bottom: 36px;
        }

        .marketing-page .ind__header h2 {
          font-family: var(--serif);
          font-size: clamp(24px, 2.5vw, 32px);
          font-weight: 600;
          color: var(--obsidian);
          margin: 8px 0 0;
        }

        .marketing-page .ind-wrap {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .marketing-page .ind-chip {
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--obsidian);
          background: rgba(248, 246, 242, 0.7);
          border: 1px solid rgba(12, 12, 14, 0.08);
          transition: all 0.2s;
        }

        .marketing-page .ind-chip:hover {
          border-color: var(--copper-deep);
          color: var(--copper-deep);
        }

        /* CTA */
        .marketing-page .cta {
          padding: 120px 0 100px;
          background: var(--bone);
          position: relative;
        }

        .marketing-page .cta__inner {
          max-width: 560px;
          margin: 0 auto;
          text-align: center;
        }

        .marketing-page .cta__inner h2 {
          font-family: var(--serif);
          font-size: clamp(30px, 3.5vw, 44px);
          font-weight: 600;
          line-height: 1.06;
          margin: 12px 0 8px;
        }

        .marketing-page .cta__inner h2 em {
          font-style: italic;
          color: var(--copper-deep);
        }

        .marketing-page .cta__sub {
          font-size: 15px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .marketing-page .cta__urgency {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 16px;
          background: rgba(138, 92, 50, 0.06);
          border: 1px solid rgba(138, 92, 50, 0.12);
          font-family: var(--mono);
          font-size: 10px;
          color: var(--copper-deep);
          margin-bottom: 24px;
        }

        .marketing-page .wl {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          text-align: left;
          margin-bottom: 10px;
        }

        .marketing-page .wl .full {
          grid-column: 1 / -1;
        }

        .marketing-page .wl input,
        .marketing-page .wl select {
          padding: 13px 14px;
          border-radius: 9px;
          border: 1px solid rgba(12, 12, 14, 0.12);
          background: rgba(248, 246, 242, 0.6);
          color: var(--obsidian);
          font-family: var(--sans);
          font-size: 13.5px;
          outline: none;
          transition: all 0.2s;
          width: 100%;
        }

        .marketing-page .wl input::placeholder {
          color: var(--muted);
        }

        .marketing-page .wl input:focus,
        .marketing-page .wl select:focus {
          border-color: var(--copper-deep);
          background: rgba(248, 246, 242, 0.8);
        }

        .marketing-page .wl select {
          appearance: none;
          cursor: pointer;
          color: var(--muted);
        }

        .marketing-page .wl select:valid {
          color: var(--obsidian);
        }

        .marketing-page .wl select option {
          background: var(--bone);
        }

        .marketing-page .wl__btn {
          grid-column: 1 / -1;
          padding: 15px;
          border-radius: 9px;
          background: var(--copper-deep);
          color: var(--bone);
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .marketing-page .wl__btn:hover {
          background: #9a6c42;
          transform: translateY(-1px);
        }

        .marketing-page .wl__note {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          margin-top: 12px;
        }

        /* FOOTER */
        .marketing-page .footer {
          padding: 32px 0;
          background: var(--white);
          border-top: 1px solid rgba(12, 12, 14, 0.06);
        }

        .marketing-page .footer__inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .marketing-page .footer__brand {
          font-family: var(--serif);
          font-size: 17px;
          font-weight: 600;
          color: var(--obsidian);
        }

        .marketing-page .footer__brand span {
          color: var(--copper-deep);
        }

        .marketing-page .footer__links {
          display: flex;
          gap: 20px;
        }

        .marketing-page .footer__link {
          font-size: 11.5px;
          color: var(--muted);
        }

        .marketing-page .footer__link:hover {
          color: var(--copper-deep);
        }

        .marketing-page .footer__copy {
          width: 100%;
          text-align: center;
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          margin-top: 10px;
        }

        /* REVEAL ANIMATION */
        .marketing-page .reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .marketing-page .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* HERO */
        .marketing-page .hero-out {
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 100px 0 60px;
          background: var(--bone);
          text-align: center;
        }

        .marketing-page .hero-out__inner {
          max-width: 760px;
          margin: 0 auto;
        }

        .marketing-page .hero-out h1 {
          font-family: var(--serif);
          font-weight: 600;
          font-size: clamp(36px, 4.2vw, 56px);
          line-height: 1.06;
          letter-spacing: -0.02em;
          margin: 14px 0 14px;
          color: var(--obsidian);
        }

        .marketing-page .hero-out h1 em {
          font-style: italic;
          color: var(--copper-deep);
        }

        .marketing-page .hero-out__sub {
          font-size: 15.5px;
          color: var(--muted);
          line-height: 1.7;
          max-width: 52ch;
          margin: 0 auto 32px;
        }

        .marketing-page .hero-out__cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }

        .marketing-page .hero-out__proof {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .marketing-page .hero-out__proof-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--success);
          animation: pulse 2.5s ease-in-out infinite;
        }

        .marketing-page .outcome-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          max-width: 900px;
          margin: 0 auto;
        }

        .marketing-page .outcome {
          padding: 28px 20px;
          border-radius: 14px;
          background: var(--white);
          border: 1px solid rgba(12, 12, 14, 0.06);
          text-align: center;
          transition: all 0.25s;
        }

        .marketing-page .outcome:hover {
          border-color: var(--copper-deep);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(138, 92, 50, 0.08);
        }

        .marketing-page .outcome__icon {
          font-size: 28px;
          margin-bottom: 10px;
        }

        .marketing-page .outcome__title {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 600;
          color: var(--obsidian);
          margin-bottom: 4px;
        }

        .marketing-page .outcome__desc {
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.5;
        }

        .marketing-page .outcome__arrow {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--copper);
          margin-bottom: 6px;
          letter-spacing: 0.1em;
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .marketing-page .story.active,
          .marketing-page .steps {
            grid-template-columns: 1fr;
          }
          .marketing-page .pain-row {
            grid-template-columns: 1fr 1fr;
          }
          .marketing-page .feat-grid {
            grid-template-columns: 1fr 1fr;
          }
          .marketing-page .wl {
            grid-template-columns: 1fr;
          }
          .marketing-page .outcome-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .marketing-page .container {
            padding: 0 20px;
          }
          .marketing-page .nav__inner {
            padding: 0 20px;
          }
          .marketing-page .pain-row,
          .marketing-page .feat-grid,
          .marketing-page .outcome-grid {
            grid-template-columns: 1fr;
          }
          .marketing-page .story-tabs {
            gap: 4px;
          }
          .marketing-page .story-tab {
            padding: 6px 12px;
            font-size: 11px;
          }
        }
      `}</style>

      <div className="marketing-page">
        {/* NAV */}
        <nav className="nav">
          <div className="nav__inner">
            <Link href="/" className="nav__brand">
              <span className="nav__dot"></span> Scrybe
            </Link>
            <a href="#cta" className="nav__cta">
              Join the Pilot
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero-out">
          <div className="container">
            <div className="hero-out__inner">
              <div className="kicker">The Organizational Intelligence Platform</div>
              <h1>
                Your conversations <em>do the work.</em>
              </h1>
              <p className="hero-out__sub">
                One input — your team&apos;s calls, meetings, and sessions. Six
                outputs — all automatic.
              </p>
              <div className="hero-out__cta-row">
                <a href="#cta" className="btn">
                  Join the Spring 2026 Pilot →
                </a>
                <div className="hero-out__proof">
                  <span className="hero-out__proof-dot"></span> 20 spots ·
                  reviewed weekly
                </div>
              </div>
              <div className="outcome-grid">
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">📝</div>
                  <div className="outcome__title">Documentation</div>
                  <div className="outcome__desc">
                    Notes, case files, SOAP records, intake forms, PRDs —
                    generated, not typed
                  </div>
                </div>
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">📊</div>
                  <div className="outcome__title">Reports</div>
                  <div className="outcome__desc">
                    Grant compliance, KPIs, pipeline reviews, promo packets —
                    auto-compiled from real data
                  </div>
                </div>
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">🧠</div>
                  <div className="outcome__title">Knowledge Base</div>
                  <div className="outcome__desc">
                    Policies, workflows, SOPs captured and searchable. Updates
                    push org-wide instantly
                  </div>
                </div>
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">✅</div>
                  <div className="outcome__title">Tasks & Follow-ups</div>
                  <div className="outcome__desc">
                    Calendar invites, action items, reminders — created the
                    moment the call ends
                  </div>
                </div>
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">🎯</div>
                  <div className="outcome__title">Context & Guides</div>
                  <div className="outcome__desc">
                    Relationship history, prompts, and personal details —
                    surfaced before hello
                  </div>
                </div>
                <div className="outcome">
                  <div className="outcome__arrow">CONVERSATION →</div>
                  <div className="outcome__icon">📈</div>
                  <div className="outcome__title">Insights</div>
                  <div className="outcome__desc">
                    Training recs, efficiency patterns, goal alerts —
                    organizational intelligence
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="trust">
          <div className="container">
            <div className="trust__inner">
              <span className="trust__badge">HIPAA Compliant</span>
              <span className="trust__badge">End-to-End Encrypted</span>
              <span className="trust__badge">No AI Training on Your Data</span>
              <span className="trust__badge">Full Audit Trail</span>
            </div>
          </div>
        </section>

        {/* PAIN SECTION */}
        <section className="pain">
          <div className="container">
            <div className="pain__header reveal">
              <div className="kicker">The problem nobody solves</div>
              <h2>
                Your team does the work twice. <em>Once</em> with people. Once
                with <em>systems.</em>
              </h2>
            </div>
            <div className="pain-row reveal">
              <div className="pain-card">
                <div className="pain-card__stat">16 hrs</div>
                <div className="pain-card__label">
                  per week on documentation that could be automatic
                </div>
              </div>
              <div className="pain-card">
                <div className="pain-card__stat">5×</div>
                <div className="pain-card__label">
                  the same information entered into different systems
                </div>
              </div>
              <div className="pain-card">
                <div className="pain-card__stat">60%</div>
                <div className="pain-card__label">
                  of organizational knowledge lives in someone&apos;s head
                </div>
              </div>
              <div className="pain-card">
                <div className="pain-card__stat">20+ hrs</div>
                <div className="pain-card__label">
                  quarterly compiling reports from memory
                </div>
              </div>
            </div>
            <div
              className="mp mp--light reveal"
              style={{ minHeight: "200px", maxWidth: "800px", margin: "0 auto" }}
            >
              <div className="mp__icon">🎬</div>
              <div className="mp__label">
                &quot;Conversations In, Everything Else Out&quot; Visual
              </div>
              <div className="mp__desc">
                Animated diagram: a single conversation icon in the center
                radiates outward into 6 outputs — Documentation, Reports,
                Knowledge Base, Tasks, Context, and Insights. Shows the
                single-input architecture.
              </div>
              <div className="mp__dims">16:9 · 1200×675 · Animated SVG or MP4 loop</div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how">
          <div className="container">
            <div className="how__header reveal">
              <div className="kicker">How it works</div>
              <h2>Conversations in. Everything else out.</h2>
            </div>
            <div className="steps reveal">
              <div className="step">
                <div className="step__num">01 · TALK</div>
                <h3>Your team has conversations</h3>
                <p>
                  Phone calls, Zoom meetings, standups, support tickets. No
                  internet? Print an attendance sheet, snap a photo. Context and
                  conversation guides surface in real-time.
                </p>
                <div className="mp mp--light" style={{ minHeight: "160px" }}>
                  <div className="mp__icon">📱</div>
                  <div className="mp__label">Screenshot</div>
                  <div className="mp__desc">
                    Incoming call with context card — relationship history, key
                    reminders, conversation guide.
                  </div>
                  <div className="mp__dims">375×300 · PNG</div>
                </div>
              </div>
              <div className="step">
                <div className="step__num">02 · GENERATE</div>
                <h3>Scrybe handles the rest</h3>
                <p>
                  Documentation writes itself. Reports compile from real data.
                  Tasks and follow-ups create automatically. Calendar invites
                  schedule themselves.
                </p>
                <div className="mp mp--light" style={{ minHeight: "160px" }}>
                  <div className="mp__icon">⚡</div>
                  <div className="mp__label">Screenshot</div>
                  <div className="mp__desc">
                    Post-call output: auto-generated notes, form data filled,
                    follow-up tasks, calendar invite sent, report updated.
                  </div>
                  <div className="mp__dims">375×300 · PNG</div>
                </div>
              </div>
              <div className="step">
                <div className="step__num">03 · COMPOUND</div>
                <h3>Your org gets smarter</h3>
                <p>
                  Every interaction builds the knowledge base. Best practices
                  surface. Goal tracking alerts you when targets are hit. The
                  org&apos;s memory never walks out the door.
                </p>
                <div className="mp mp--light" style={{ minHeight: "160px" }}>
                  <div className="mp__icon">🧠</div>
                  <div className="mp__label">Screenshot</div>
                  <div className="mp__desc">
                    Knowledge base, goal tracker at 82%, training recommendation,
                    organizational intelligence dashboard.
                  </div>
                  <div className="mp__dims">375×300 · PNG</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STORIES */}
        <section className="stories">
          <div className="container">
            <div className="stories__header reveal">
              <div className="kicker">Sound familiar?</div>
              <h2>
                One platform. Every team. Every conversation becomes an output.
              </h2>
            </div>
            <div className="story-tabs reveal">
              {storyTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`story-tab ${activeStory === tab.id ? "active" : ""}`}
                  onClick={() => setActiveStory(tab.id)}
                >
                  {tab.label}
                </div>
              ))}
            </div>
            {Object.entries(stories).map(([id, story]) => (
              <div
                key={id}
                className={`story ${activeStory === id ? "active" : ""}`}
              >
                <div className="story__copy">
                  <h3>{story.title}</h3>
                  <p className="story__scenario">{story.scenario}</p>
                  <div className="story__with-scrybe">
                    <div className="story__with-label">✓ With Scrybe</div>
                    <div className="story__with-text">{story.withScrybe}</div>
                  </div>
                </div>
                <div className="mp" style={{ minHeight: "340px" }}>
                  <div className="mp__icon">{story.mockup.icon}</div>
                  <div className="mp__label">{story.mockup.label}</div>
                  <div className="mp__desc">{story.mockup.desc}</div>
                  <div className="mp__dims">{story.mockup.dims}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="features">
          <div className="container">
            <div className="features__header reveal">
              <div className="kicker">The platform</div>
              <h2>Eight engines. One conversation to power them all.</h2>
            </div>
            <div className="feat-grid reveal">
              <div className="feat">
                <div className="feat__icon">🎙️</div>
                <h4>Conversation Capture</h4>
                <p>
                  Phone calls, Zoom meetings, standups, support tickets — plus
                  paper-based sessions via photo upload.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">📝</div>
                <h4>Auto-Documentation</h4>
                <p>
                  Notes, case files, SOAP records, intake forms, PRDs, tech specs
                  — generated, not typed.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">🎯</div>
                <h4>Conversation Guides</h4>
                <p>
                  Real-time prompts, reminders, and key details — surfaced during
                  live calls.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">📊</div>
                <h4>Reports & Goal Tracking</h4>
                <p>
                  Grant reports, KPI dashboards, pipeline reviews. Alerts when you
                  hit targets — even early.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">📋</div>
                <h4>Program & Session Tracking</h4>
                <p>
                  Multi-session treatments, training programs, client journeys.
                  Completion tracking for compliance.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">🧠</div>
                <h4>Knowledge System</h4>
                <p>
                  Policies, workflows, and SOPs captured from practice. Updates
                  push org-wide instantly.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">👁️</div>
                <h4>Workforce Intelligence</h4>
                <p>
                  Team performance visibility without asking. Training recs from
                  efficiency data.
                </p>
              </div>
              <div className="feat">
                <div className="feat__icon">📷</div>
                <h4>IRL-to-Digital Capture</h4>
                <p>
                  No internet? Print attendance sheets, snap a photo. AI logs
                  attendance and generates notes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="ind">
          <div className="container">
            <div className="ind__header reveal">
              <div className="kicker">Who it&apos;s for</div>
              <h2>If your team runs on conversations, Scrybe runs for you.</h2>
            </div>
            <div className="ind-wrap reveal">
              {[
                "Sales & Account Management",
                "Nonprofit Case Management",
                "Healthcare & Medical Practices",
                "Behavioral Health",
                "UX Research",
                "Product & Engineering Teams",
                "Customer Support",
                "Legal Services",
                "Real Estate",
                "People Management",
                "Multi-Location Operations",
                "Tax & Financial Advisory",
                "Education & Coaching",
              ].map((industry) => (
                <div key={industry} className="ind-chip">
                  {industry}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta" id="cta">
          <div className="container">
            <div className="cta__inner reveal">
              <div className="kicker">Spring 2026 Pilot</div>
              <h2>
                Your conversations should <em>do the work.</em>
              </h2>
              <p className="cta__sub">
                20 founding organizations get priority pricing, white-glove
                onboarding, and direct roadmap input.
              </p>
              <div className="cta__urgency">Applications reviewed weekly</div>
              <form className="wl" onSubmit={handleFormSubmit}>
                <input type="text" placeholder="First name" required />
                <input type="text" placeholder="Last name" required />
                <input
                  type="email"
                  placeholder="Work email"
                  required
                  className="full"
                />
                <input type="text" placeholder="Organization" required />
                <select required defaultValue="">
                  <option value="" disabled>
                    Your role
                  </option>
                  <option>Sales / Account Management</option>
                  <option>Case Manager / Social Worker</option>
                  <option>Program Director</option>
                  <option>Executive Director / CEO</option>
                  <option>Engineering / Product Manager</option>
                  <option>UX Researcher</option>
                  <option>IT / Operations</option>
                  <option>Clinician / Therapist / Doctor</option>
                  <option>Customer Support Lead</option>
                  <option>Other</option>
                </select>
                <select required defaultValue="">
                  <option value="" disabled>
                    Team size
                  </option>
                  <option>1–5</option>
                  <option>6–15</option>
                  <option>16–50</option>
                  <option>51–100</option>
                  <option>100+</option>
                </select>
                <select required defaultValue="" className="full">
                  <option value="" disabled>
                    Industry
                  </option>
                  <option>Sales / Tech</option>
                  <option>Nonprofit / Human Services</option>
                  <option>Behavioral Health</option>
                  <option>Healthcare / Medical</option>
                  <option>UX Research / Design</option>
                  <option>Product / Engineering</option>
                  <option>Customer Support</option>
                  <option>Legal</option>
                  <option>Real Estate</option>
                  <option>Education</option>
                  <option>Financial Services</option>
                  <option>Government</option>
                  <option>Multi-Location Retail / Operations</option>
                  <option>Other</option>
                </select>
                <button type="submit" className="wl__btn">
                  Apply for the Spring 2026 Pilot →
                </button>
              </form>
              <div className="wl__note">
                No credit card · Invite-only · One business day response
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="container">
            <div className="footer__inner">
              <div className="footer__brand">
                Scrybe<span>.</span>
              </div>
              <div className="footer__links">
                <a href="#" className="footer__link">
                  Privacy
                </a>
                <a href="#" className="footer__link">
                  Terms
                </a>
                <a href="#" className="footer__link">
                  Security
                </a>
                <a href="mailto:hello@scrybe.app" className="footer__link">
                  Contact
                </a>
              </div>
              <div className="footer__copy">© 2026 Scrybe · Phoenixing LLC</div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
