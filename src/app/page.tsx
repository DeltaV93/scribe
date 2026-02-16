"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  BarChart3,
  Brain,
  CheckCircle2,
  Target,
  TrendingUp,
  Video,
  Clapperboard,
  Smartphone,
  Zap,
  Building2,
  Microscope,
  Users,
  Rocket,
  Headphones,
  Mic2,
  ClipboardList,
  Eye,
  Camera,
} from "lucide-react";

export default function HomePage() {
  const [activeStory, setActiveStory] = useState("sales");

  useEffect(() => {
    // Reveal animation on scroll
    const revealElements = document.querySelectorAll(".reveal");
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
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector(".wl__btn") as HTMLButtonElement;
    if (btn) {
      btn.textContent = "You're on the list ✓";
      btn.style.background = "var(--success)";
      btn.disabled = true;
    }
  };

  const showStory = (id: string) => {
    setActiveStory(id);
  };

  return (
    <>
      <style jsx global>{`
        :root {
          /* SCRYBE Calm Infrastructure Palette */
          --ink: #111111;
          --paper: #FAFAF8;
          --stone: #E7E5E0;
          --moss: #2F5D50;
          --gold: #C2A86B;

          /* Ink opacity variants */
          --ink-80: rgba(17,17,17,.80);
          --ink-70: rgba(17,17,17,.70);
          --ink-60: rgba(17,17,17,.60);
          --ink-12: rgba(17,17,17,.12);
          --ink-08: rgba(17,17,17,.08);

          /* Semantic colors */
          --success: #3D7A63;
          --error: #A94A4A;
          --warning: #B0893B;
          --info: #4A6FA9;

          /* Typography - Inter only */
          --font: "Inter", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

          /* Radii */
          --r10: 10px;
          --r14: 14px;
          --r18: 18px;

          /* Shadows */
          --shadow-sm: 0 8px 20px rgba(17,17,17,.06);
          --shadow-md: 0 12px 40px rgba(17,17,17,.08);
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          font-family: var(--font);
          color: var(--ink);
          background: var(--paper);
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 32px;
        }

        .kicker {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--moss);
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(61, 122, 99, 0.4); }
          50% { box-shadow: 0 0 14px rgba(61, 122, 99, 0.6); }
        }

        /* NAV */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          height: 56px;
          display: flex;
          align-items: center;
          background: rgba(250,250,248,.85);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--ink-08);
        }

        .nav__inner {
          max-width: 1120px;
          margin: 0 auto;
          width: 100%;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav__brand {
          font-family: var(--font);
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .nav__dot {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--ink);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--paper);
          font-weight: 700;
          font-size: 14px;
        }

        .nav__dot::after {
          content: 'S';
        }

        .nav__cta {
          font-size: 14px;
          font-weight: 600;
          color: var(--paper);
          background: var(--ink);
          padding: 12px 20px;
          border-radius: var(--r10);
          transition: all 0.15s;
        }

        .nav__cta:hover {
          background: var(--ink-80);
        }

        /* BUTTONS */
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 14px 28px;
          background: var(--ink);
          color: var(--paper);
          font-family: var(--font);
          font-size: 14px;
          font-weight: 600;
          border-radius: var(--r10);
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn:hover {
          background: var(--ink-80);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .btn--outline {
          background: transparent;
          color: var(--ink);
          border: 1.5px solid var(--ink-12);
        }

        .btn--outline:hover {
          background: rgba(231,229,224,.55);
          border-color: rgba(17,17,17,.24);
          box-shadow: none;
        }

        /* MEDIA PLACEHOLDER */
        .mp {
          background: rgba(17,17,17,.02);
          border: 2px dashed var(--ink-12);
          border-radius: var(--r14);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 32px 20px;
        }

        .mp__icon {
          font-size: 28px;
          margin-bottom: 8px;
          opacity: 0.6;
        }

        .mp__label {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--moss);
          margin-bottom: 5px;
        }

        .mp__desc {
          font-size: 12px;
          color: var(--ink-60);
          line-height: 1.5;
          max-width: 440px;
        }

        .mp__dims {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--ink-60);
          opacity: 0.5;
          margin-top: 6px;
        }

        /* HERO */
        .hero-out {
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 100px 0 60px;
          background: var(--paper);
          text-align: center;
        }

        .hero-out__inner {
          max-width: 760px;
          margin: 0 auto;
        }

        .hero-out h1 {
          font-family: var(--font);
          font-weight: 800;
          font-size: clamp(36px, 4.2vw, 56px);
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin: 14px 0 14px;
          color: var(--ink);
        }

        .hero-out h1 em {
          font-style: italic;
          color: var(--moss);
        }

        .hero-out__sub {
          font-size: 16px;
          color: var(--ink-70);
          line-height: 1.6;
          max-width: 52ch;
          margin: 0 auto 32px;
        }

        .hero-out__cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }

        .hero-out__proof {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-60);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hero-out__proof-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--success);
          animation: pulse 2.5s ease-in-out infinite;
        }

        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          max-width: 900px;
          margin: 0 auto;
        }

        .outcome {
          padding: 28px 20px;
          border-radius: var(--r14);
          background: var(--paper);
          border: 1px solid var(--ink-08);
          text-align: center;
          transition: all 0.25s;
          box-shadow: var(--shadow-sm);
        }

        .outcome:hover {
          border-color: var(--moss);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .outcome__arrow {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--moss);
          margin-bottom: 6px;
          letter-spacing: 0.08em;
        }

        .outcome__icon {
          font-size: 28px;
          margin-bottom: 10px;
        }

        .outcome__title {
          font-family: var(--font);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .outcome__desc {
          font-size: 13px;
          color: var(--ink-70);
          line-height: 1.5;
        }

        /* TRUST */
        .trust {
          padding: 28px 0;
          border-top: 1px solid var(--ink-08);
          border-bottom: 1px solid var(--ink-08);
          background: var(--paper);
        }

        .trust__inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
        }

        .trust__badge {
          font-size: 12px;
          font-weight: 600;
          color: var(--moss);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .trust__badge::before {
          content: '✓';
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          background: rgba(47,93,80,.08);
          font-size: 9px;
          color: var(--moss);
        }

        /* SOCIAL PROOF */
        .proof {
          padding: 80px 0;
          background: var(--paper);
          border-top: 1px solid var(--ink-08);
          border-bottom: 1px solid var(--ink-08);
        }

        .proof__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: center;
        }

        .proof__text {
          font-family: var(--font);
          font-size: clamp(20px, 2.4vw, 28px);
          font-style: italic;
          font-weight: 500;
          line-height: 1.35;
          color: var(--ink);
        }

        .proof__attr {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--moss);
          margin-top: 14px;
        }

        .proof__context {
          font-size: 13px;
          color: var(--ink-60);
          margin-top: 8px;
          line-height: 1.5;
        }

        /* PAIN */
        .pain {
          padding: 80px 0;
          background: var(--paper);
        }

        .pain__header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 40px;
        }

        .pain__header h2 {
          font-family: var(--font);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.02em;
          margin: 12px 0 0;
        }

        .pain__header h2 em {
          font-style: italic;
          color: var(--moss);
        }

        .pain-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 40px;
        }

        .pain-card {
          padding: 24px 20px;
          border-radius: var(--r14);
          background: rgba(169,74,74,.03);
          border: 1px solid rgba(169,74,74,.08);
          text-align: center;
        }

        .pain-card__stat {
          font-family: var(--font);
          font-size: 34px;
          font-weight: 800;
          color: var(--error);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .pain-card__label {
          font-size: 13px;
          color: var(--ink);
          margin-top: 4px;
          line-height: 1.4;
        }

        /* HOW */
        .how {
          padding: 100px 0;
          background: var(--paper);
        }

        .how__header {
          text-align: center;
          max-width: 500px;
          margin: 0 auto 48px;
        }

        .how__header h2 {
          font-family: var(--font);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 12px 0 0;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .step {
          padding: 28px 24px;
          border-radius: var(--r14);
          background: var(--paper);
          border: 1px solid var(--ink-08);
          box-shadow: var(--shadow-sm);
        }

        .step__num {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--moss);
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .step h3 {
          font-family: var(--font);
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 6px;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }

        .step p {
          font-size: 14px;
          color: var(--ink-70);
          line-height: 1.6;
          margin-bottom: 12px;
        }

        /* STORIES */
        .stories {
          padding: 100px 0;
          background: var(--stone);
        }

        .stories__header {
          text-align: center;
          max-width: 560px;
          margin: 0 auto 48px;
        }

        .stories__header h2 {
          font-family: var(--font);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.02em;
          margin: 12px 0 0;
          color: var(--ink);
        }

        .story-tabs {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-bottom: 36px;
          flex-wrap: wrap;
        }

        .story-tab {
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-70);
          background: var(--paper);
          border: 1px solid var(--ink-08);
          cursor: pointer;
          transition: all 0.2s;
        }

        .story-tab:hover,
        .story-tab.active {
          color: var(--ink);
          border-color: var(--moss);
          background: rgba(47,93,80,.06);
        }

        .story {
          display: none;
          animation: fadeIn 0.3s ease;
        }

        .story.active {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          align-items: start;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .story__copy h3 {
          font-family: var(--font);
          font-size: 24px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.01em;
          margin-bottom: 12px;
          color: var(--ink);
        }

        .story__scenario {
          font-size: 15px;
          color: var(--ink-70);
          line-height: 1.7;
          margin-bottom: 16px;
        }

        .story__scenario strong {
          color: var(--ink);
        }

        .story__with-scrybe {
          padding: 16px;
          border-radius: var(--r10);
          background: rgba(61,122,99,.06);
          border: 1px solid rgba(61,122,99,.12);
        }

        .story__with-label {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--success);
          margin-bottom: 6px;
        }

        .story__with-text {
          font-size: 14px;
          color: var(--ink-70);
          line-height: 1.6;
        }

        /* FEATURES */
        .features {
          padding: 100px 0;
          background: var(--paper);
        }

        .features__header {
          text-align: center;
          max-width: 500px;
          margin: 0 auto 48px;
        }

        .features__header h2 {
          font-family: var(--font);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 12px 0 0;
          color: var(--ink);
        }

        .feat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .feat {
          padding: 24px 20px;
          border-radius: var(--r14);
          background: var(--paper);
          border: 1px solid var(--ink-08);
          box-shadow: var(--shadow-sm);
        }

        .feat__icon {
          font-size: 22px;
          margin-bottom: 10px;
        }

        .feat h4 {
          font-family: var(--font);
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 4px;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .feat p {
          font-size: 13px;
          color: var(--ink-70);
          line-height: 1.5;
        }

        /* INDUSTRIES */
        .ind {
          padding: 80px 0;
          background: var(--paper);
        }

        .ind__header {
          text-align: center;
          margin-bottom: 36px;
        }

        .ind__header h2 {
          font-family: var(--font);
          font-size: clamp(24px, 2.5vw, 32px);
          font-weight: 800;
          color: var(--ink);
          margin: 8px 0 0;
          letter-spacing: -0.02em;
        }

        .ind-wrap {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ind-chip {
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
          background: var(--paper);
          border: 1px solid var(--ink-08);
          transition: all 0.2s;
        }

        .ind-chip:hover {
          border-color: var(--moss);
          color: var(--moss);
        }

        /* CTA */
        .cta {
          padding: 120px 0 100px;
          background: var(--paper);
          position: relative;
        }

        .cta__inner {
          max-width: 560px;
          margin: 0 auto;
          text-align: center;
        }

        .cta__inner h2 {
          font-family: var(--font);
          font-size: clamp(30px, 3.5vw, 44px);
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -0.03em;
          margin: 12px 0 8px;
        }

        .cta__inner h2 em {
          font-style: italic;
          color: var(--moss);
        }

        .cta__sub {
          font-size: 16px;
          color: var(--ink-70);
          margin-bottom: 8px;
        }

        .cta__urgency {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 16px;
          background: rgba(47,93,80,.06);
          border: 1px solid rgba(47,93,80,.12);
          font-family: var(--mono);
          font-size: 11px;
          color: var(--moss);
          margin-bottom: 24px;
        }

        .wl {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          text-align: left;
          margin-bottom: 10px;
        }

        .wl .full {
          grid-column: 1 / -1;
        }

        .wl input,
        .wl select {
          padding: 13px 14px;
          border-radius: var(--r10);
          border: 1px solid var(--ink-12);
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font);
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          width: 100%;
        }

        .wl input::placeholder {
          color: var(--ink-60);
        }

        .wl input:focus,
        .wl select:focus {
          border-color: var(--moss);
          box-shadow: 0 0 0 3px rgba(47,93,80,.15);
        }

        .wl select {
          appearance: none;
          cursor: pointer;
          color: var(--ink-60);
        }

        .wl select:valid {
          color: var(--ink);
        }

        .wl select option {
          background: var(--paper);
        }

        .wl__btn {
          grid-column: 1 / -1;
          padding: 15px;
          border-radius: var(--r10);
          background: var(--ink);
          color: var(--paper);
          font-family: var(--font);
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }

        .wl__btn:hover {
          background: var(--ink-80);
          transform: translateY(-1px);
        }

        .wl__note {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-60);
          margin-top: 12px;
        }

        /* FOOTER */
        .footer {
          padding: 32px 0;
          background: var(--paper);
          border-top: 1px solid var(--ink-08);
        }

        .footer__inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .footer__brand {
          font-family: var(--font);
          font-size: 17px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.01em;
        }

        .footer__brand span {
          color: var(--moss);
        }

        .footer__links {
          display: flex;
          gap: 20px;
        }

        .footer__link {
          font-size: 12px;
          color: var(--ink-60);
        }

        .footer__link:hover {
          color: var(--moss);
        }

        .footer__copy {
          width: 100%;
          text-align: center;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-60);
          margin-top: 10px;
        }

        /* REVEAL ANIMATION */
        .reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .story.active,
          .steps,
          .proof__grid {
            grid-template-columns: 1fr;
          }

          .pain-row {
            grid-template-columns: 1fr 1fr;
          }

          .feat-grid {
            grid-template-columns: 1fr 1fr;
          }

          .wl {
            grid-template-columns: 1fr;
          }

          .outcome-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .container {
            padding: 0 20px;
          }

          .nav__inner {
            padding: 0 20px;
          }

          .pain-row,
          .feat-grid {
            grid-template-columns: 1fr;
          }

          .story-tabs {
            gap: 4px;
          }

          .story-tab {
            padding: 6px 12px;
            font-size: 12px;
          }

          .outcome-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav__inner">
          <a href="#" className="nav__brand">
            <span className="nav__dot"></span> Scrybe
          </a>
          <a href="#cta" className="nav__cta">Join the Pilot</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-out">
        <div className="container">
          <div className="hero-out__inner">
            <div className="kicker">The Organizational Intelligence Platform</div>
            <h1>Your conversations <em>do the work.</em></h1>
            <p className="hero-out__sub">One input — your team&apos;s calls, meetings, and sessions. Six outputs — all automatic.</p>
            <div className="hero-out__cta-row">
              <a href="#cta" className="btn">Join the Spring 2026 Pilot →</a>
              <div className="hero-out__proof">
                <span className="hero-out__proof-dot"></span> 20 spots · reviewed weekly
              </div>
            </div>
            <div className="outcome-grid">
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><FileText size={28} /></div>
                <div className="outcome__title">Documentation</div>
                <div className="outcome__desc">Notes, case files, SOAP records, intake forms, PRDs — generated, not typed</div>
              </div>
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><BarChart3 size={28} /></div>
                <div className="outcome__title">Reports</div>
                <div className="outcome__desc">Grant compliance, KPIs, pipeline reviews, promo packets — auto-compiled from real data</div>
              </div>
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><Brain size={28} /></div>
                <div className="outcome__title">Knowledge Base</div>
                <div className="outcome__desc">Policies, workflows, SOPs captured and searchable. Updates push org-wide instantly</div>
              </div>
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><CheckCircle2 size={28} /></div>
                <div className="outcome__title">Tasks & Follow-ups</div>
                <div className="outcome__desc">Calendar invites, action items, reminders — created the moment the call ends</div>
              </div>
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><Target size={28} /></div>
                <div className="outcome__title">Context & Guides</div>
                <div className="outcome__desc">Relationship history, prompts, and personal details — surfaced before hello</div>
              </div>
              <div className="outcome">
                <div className="outcome__arrow">CONVERSATION →</div>
                <div className="outcome__icon"><TrendingUp size={28} /></div>
                <div className="outcome__title">Insights</div>
                <div className="outcome__desc">Training recs, efficiency patterns, goal alerts — organizational intelligence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
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

      {/* SOCIAL PROOF */}
      <section className="proof">
        <div className="container">
          <div className="proof__grid reveal">
            <div>
              <div className="proof__text">&quot;This would allow us to scale. We wouldn&apos;t have to focus so much on our reporting side of things. It would alleviate the hassle of the reporting and let the reports report... just let the people work with people.&quot;</div>
              <div className="proof__attr">— Carly, Director of Reentry Services · Operation New Hope</div>
              <div className="proof__context">$30M nonprofit · 400 clients/week · 14 partner organizations · Been looking for this solution for over a year</div>
            </div>
            <div className="mp" style={{ minHeight: "300px" }}>
              <div className="mp__icon"><Video size={28} /></div>
              <div className="mp__label">Testimonial Video or Photo</div>
              <div className="mp__desc">Video clip of Carly: from bogged down with data to letting people work with people. &quot;I am so relieved right now.&quot;</div>
              <div className="mp__dims">1:1 or 4:3 · 800×800 · MP4 (30-60 sec) or JPG</div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section className="pain">
        <div className="container">
          <div className="pain__header reveal">
            <div className="kicker">The problem nobody solves</div>
            <h2>Your team does the work twice. <em>Once</em> with people. Once with <em>systems.</em></h2>
          </div>
          <div className="pain-row reveal">
            <div className="pain-card">
              <div className="pain-card__stat">16 hrs</div>
              <div className="pain-card__label">per week on documentation that could be automatic</div>
            </div>
            <div className="pain-card">
              <div className="pain-card__stat">5×</div>
              <div className="pain-card__label">the same information entered into different systems</div>
            </div>
            <div className="pain-card">
              <div className="pain-card__stat">60%</div>
              <div className="pain-card__label">of organizational knowledge lives in someone&apos;s head</div>
            </div>
            <div className="pain-card">
              <div className="pain-card__stat">20+ hrs</div>
              <div className="pain-card__label">quarterly compiling reports from memory</div>
            </div>
          </div>
          <div className="mp reveal" style={{ minHeight: "200px", maxWidth: "800px", margin: "0 auto" }}>
            <div className="mp__icon"><Clapperboard size={28} /></div>
            <div className="mp__label">&quot;Conversations In, Everything Else Out&quot; Visual</div>
            <div className="mp__desc">Animated diagram: a single conversation icon in the center radiates outward into 6 outputs — Documentation, Reports, Knowledge Base, Tasks, Context, and Insights. Shows the single-input architecture.</div>
            <div className="mp__dims">16:9 · 1200×675 · Animated SVG or MP4 loop</div>
          </div>
        </div>
      </section>

      {/* HOW */}
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
              <p>Phone calls, Zoom meetings, standups, support tickets. No internet? Print an attendance sheet, snap a photo. Context and conversation guides surface in real-time.</p>
              <div className="mp" style={{ minHeight: "160px" }}>
                <div className="mp__icon"><Smartphone size={28} /></div>
                <div className="mp__label">Screenshot</div>
                <div className="mp__desc">Incoming call with context card — relationship history, key reminders, conversation guide.</div>
                <div className="mp__dims">375×300 · PNG</div>
              </div>
            </div>
            <div className="step">
              <div className="step__num">02 · GENERATE</div>
              <h3>Scrybe handles the rest</h3>
              <p>Documentation writes itself. Reports compile from real data. Tasks and follow-ups create automatically. Calendar invites schedule themselves.</p>
              <div className="mp" style={{ minHeight: "160px" }}>
                <div className="mp__icon"><Zap size={28} /></div>
                <div className="mp__label">Screenshot</div>
                <div className="mp__desc">Post-call output: auto-generated notes, form data filled, follow-up tasks, calendar invite sent, report updated.</div>
                <div className="mp__dims">375×300 · PNG</div>
              </div>
            </div>
            <div className="step">
              <div className="step__num">03 · COMPOUND</div>
              <h3>Your org gets smarter</h3>
              <p>Every interaction builds the knowledge base. Best practices surface. Goal tracking alerts you when targets are hit. The org&apos;s memory never walks out the door.</p>
              <div className="mp" style={{ minHeight: "160px" }}>
                <div className="mp__icon"><Brain size={28} /></div>
                <div className="mp__label">Screenshot</div>
                <div className="mp__desc">Knowledge base, goal tracker at 82%, training recommendation, organizational intelligence dashboard.</div>
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
            <h2>One platform. Every team. Every conversation becomes an output.</h2>
          </div>
          <div className="story-tabs reveal">
            <div className={`story-tab ${activeStory === "sales" ? "active" : ""}`} onClick={() => showStory("sales")}>Sales</div>
            <div className={`story-tab ${activeStory === "nonprofit" ? "active" : ""}`} onClick={() => showStory("nonprofit")}>Nonprofits</div>
            <div className={`story-tab ${activeStory === "healthcare" ? "active" : ""}`} onClick={() => showStory("healthcare")}>Healthcare</div>
            <div className={`story-tab ${activeStory === "research" ? "active" : ""}`} onClick={() => showStory("research")}>UX Research</div>
            <div className={`story-tab ${activeStory === "management" ? "active" : ""}`} onClick={() => showStory("management")}>People Managers</div>
            <div className={`story-tab ${activeStory === "product" ? "active" : ""}`} onClick={() => showStory("product")}>Product Teams</div>
            <div className={`story-tab ${activeStory === "support" ? "active" : ""}`} onClick={() => showStory("support")}>Customer Support</div>
            <div className={`story-tab ${activeStory === "operations" ? "active" : ""}`} onClick={() => showStory("operations")}>Multi-Location Ops</div>
          </div>

          {/* Sales Story */}
          <div className={`story ${activeStory === "sales" ? "active" : ""}`} id="story-sales">
            <div className="story__copy">
              <h3>Your top rep closes because they remember the little things.</h3>
              <p className="story__scenario">Jordan remembers that his prospect&apos;s kid just started Little League. He brings it up on the call — the prospect lights up. That&apos;s not CRM data. That&apos;s <strong>relationship intelligence.</strong> But when Jordan gets promoted, <strong>$2M in pipeline goes cold overnight.</strong></p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Every call auto-captures the Little League detail, org chart intel, and budget timing. Conversation guides remind reps what to bring up. When reps move up, the next person inherits a living relationship — not an empty record.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Smartphone size={28} /></div>
              <div className="mp__label">Sales Story Screenshot</div>
              <div className="mp__desc">Incoming call from &quot;David Chen, VP Eng @ Acme&quot; with context card: last call topics, personal note &quot;daughter Maya — Little League playoffs next week.&quot;</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Nonprofit Story */}
          <div className={`story ${activeStory === "nonprofit" ? "active" : ""}`} id="story-nonprofit">
            <div className="story__copy">
              <h3>Your case managers chose this work to help people. Not fill out forms.</h3>
              <p className="story__scenario">Maria serves 400 clients weekly across 14 partner organizations. Every call generates paperwork — the same data, <strong>3–5 times.</strong> Every quarterly report: 20+ hours. And when staff leaves, years of client trust vanish.</p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Calls auto-document. Grant reports auto-generate with narratives, not just numbers. For group sessions where devices aren&apos;t allowed, snap a photo of an attendance sheet — AI logs all 400 clients and generates session notes.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Smartphone size={28} /></div>
              <div className="mp__label">Nonprofit Story Screenshot</div>
              <div className="mp__desc">Client &quot;James Walker&quot; with reentry milestones, program completion (Step 3/5), grant compliance dashboard at 72%.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Healthcare Story */}
          <div className={`story ${activeStory === "healthcare" ? "active" : ""}`} id="story-healthcare">
            <div className="story__copy">
              <h3>Your patients come back for session 4. Do you remember sessions 1–3?</h3>
              <p className="story__scenario">Dr. Okafor sees 25 patients daily. Each has a multi-visit treatment plan. She spends <strong>90 minutes after clinic</strong> writing SOAP notes. Her biller waits. The front desk has <strong>no context when patients call between visits.</strong></p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">SOAP notes auto-generate. Treatment tracks across sessions 1–6. Billing docs ready before checkout. For group sessions in restricted facilities, photo-upload attendance handles it all.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Building2 size={28} /></div>
              <div className="mp__label">Healthcare Screenshot</div>
              <div className="mp__desc">Patient &quot;Sarah M.&quot; — session 4/6, auto-SOAP note, billing codes ready, mobility progress chart.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Research Story */}
          <div className={`story ${activeStory === "research" ? "active" : ""}`} id="story-research">
            <div className="story__copy">
              <h3>Your best insights come when you stop taking notes and start listening.</h3>
              <p className="story__scenario">Priya runs 45-minute interviews. The best moments come off-script. But she can&apos;t take notes AND be present. After each call: <strong>90 minutes reconstructing what was said.</strong></p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Full interviews captured. Notes auto-generate in her template. Cross-interview patterns surface: &quot;5/8 mentioned onboarding friction.&quot; PRD input forms auto-populate from findings.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Microscope size={28} /></div>
              <div className="mp__label">Research Screenshot</div>
              <div className="mp__desc">Participant &quot;User #7&quot; with discussion guide, live transcription, auto-tagged insights, cross-interview patterns.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Management Story */}
          <div className={`story ${activeStory === "management" ? "active" : ""}`} id="story-management">
            <div className="story__copy">
              <h3>Your engineer mentioned wanting to learn Rust three months ago. Do you remember?</h3>
              <p className="story__scenario">Marcus has 8 direct reports. Promo packet time arrives and his notes are... sparse. <strong>12 hours to write a packet that still feels thin.</strong> His director wants a team health report — he has nothing but vibes.</p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Every 1:1 auto-documented. Promo packets write themselves from 6 months of documented growth. Reports show one team member is 30% slower — Scrybe suggests training.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Users size={28} /></div>
              <div className="mp__label">Manager Screenshot</div>
              <div className="mp__desc">&quot;Aisha Patel, Senior Engineer&quot; — 12 documented 1:1s, growth goals, &quot;Generate Promo Packet&quot; button.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Product Story */}
          <div className={`story ${activeStory === "product" ? "active" : ""}`} id="story-product">
            <div className="story__copy">
              <h3>Your standup just pushed back the timeline. Does the VP know yet?</h3>
              <p className="story__scenario">A blocker surfaces in Tuesday&apos;s standup that pushes the launch by two weeks. <strong>The VP finds out on Friday.</strong> Ravi spends 4 hours a week writing status updates that are outdated by the time he sends them.</p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Scrybe auto-joins standups. PRDs generate from product conversations. Timeline changes auto-push to stakeholders — the VP knows Tuesday, not Friday.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Rocket size={28} /></div>
              <div className="mp__label">Product Team Screenshot</div>
              <div className="mp__desc">Auto-generated PRD with linked standup notes, auto-detected timeline change, stakeholder notification sent.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Support Story */}
          <div className={`story ${activeStory === "support" ? "active" : ""}`} id="story-support">
            <div className="story__copy">
              <h3>Your support team follows a workflow that changed last week. Do they know?</h3>
              <p className="story__scenario">The refund policy changed Tuesday. Three reps gave the old policy Wednesday. <strong>Training takes weeks to propagate.</strong> The best rep&apos;s shortcuts live in her head — when she&apos;s out, resolution times spike 40%.</p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Knowledge system updates the moment a policy changes. Conversation guides surface the right process during calls. Best practices auto-capture from top performers and become team playbooks.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><Headphones size={28} /></div>
              <div className="mp__label">Support Screenshot</div>
              <div className="mp__desc">Active support call with updated refund policy flagged, suggested responses, auto-generated ticket summary.</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>

          {/* Operations Story */}
          <div className={`story ${activeStory === "operations" ? "active" : ""}`} id="story-operations">
            <div className="story__copy">
              <h3>Location 7 figured out intake. The other 11 don&apos;t know yet.</h3>
              <p className="story__scenario">Regional director overseeing 12 locations. Best practices trapped in one manager&apos;s head. <strong>Three weeks just getting everyone to submit data in the same format.</strong></p>
              <div className="story__with-scrybe">
                <div className="story__with-label">✓ With Scrybe</div>
                <div className="story__with-text">Scrybe captures how every location operates. Surfaces what works: &quot;Location 7&apos;s intake is 40% faster.&quot; Codifies best practices into playbooks. Reports auto-generate across all locations.</div>
              </div>
            </div>
            <div className="mp" style={{ minHeight: "340px" }}>
              <div className="mp__icon"><BarChart3 size={28} /></div>
              <div className="mp__label">Operations Screenshot</div>
              <div className="mp__desc">Multi-location dashboard: 12 pins, performance table, &quot;Location 7 — 40% faster. View playbook →&quot;</div>
              <div className="mp__dims">4:3 · 900×675 · PNG</div>
            </div>
          </div>
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
              <div className="feat__icon"><Mic2 size={22} /></div>
              <h4>Conversation Capture</h4>
              <p>Phone calls, Zoom meetings, standups, support tickets — plus paper-based sessions via photo upload.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><FileText size={22} /></div>
              <h4>Auto-Documentation</h4>
              <p>Notes, case files, SOAP records, intake forms, PRDs, tech specs — generated, not typed.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><Target size={22} /></div>
              <h4>Conversation Guides</h4>
              <p>Real-time prompts, reminders, and key details — surfaced during live calls.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><BarChart3 size={22} /></div>
              <h4>Reports & Goal Tracking</h4>
              <p>Grant reports, KPI dashboards, pipeline reviews. Alerts when you hit targets — even early.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><ClipboardList size={22} /></div>
              <h4>Program & Session Tracking</h4>
              <p>Multi-session treatments, training programs, client journeys. Completion tracking for compliance.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><Brain size={22} /></div>
              <h4>Knowledge System</h4>
              <p>Policies, workflows, and SOPs captured from practice. Updates push org-wide instantly.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><Eye size={22} /></div>
              <h4>Workforce Intelligence</h4>
              <p>Team performance visibility without asking. Training recs from efficiency data.</p>
            </div>
            <div className="feat">
              <div className="feat__icon"><Camera size={22} /></div>
              <h4>IRL-to-Digital Capture</h4>
              <p>No internet? Print attendance sheets, snap a photo. AI logs attendance and generates notes.</p>
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
            <div className="ind-chip">Sales & Account Management</div>
            <div className="ind-chip">Nonprofit Case Management</div>
            <div className="ind-chip">Healthcare & Medical Practices</div>
            <div className="ind-chip">Behavioral Health</div>
            <div className="ind-chip">UX Research</div>
            <div className="ind-chip">Product & Engineering Teams</div>
            <div className="ind-chip">Customer Support</div>
            <div className="ind-chip">Legal Services</div>
            <div className="ind-chip">Real Estate</div>
            <div className="ind-chip">People Management</div>
            <div className="ind-chip">Multi-Location Operations</div>
            <div className="ind-chip">Tax & Financial Advisory</div>
            <div className="ind-chip">Education & Coaching</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="cta">
        <div className="container">
          <div className="cta__inner reveal">
            <div className="kicker">Spring 2026 Pilot</div>
            <h2>Your conversations should <em>do the work.</em></h2>
            <p className="cta__sub">20 founding organizations get priority pricing, white-glove onboarding, and direct roadmap input.</p>
            <div className="cta__urgency">Applications reviewed weekly</div>
            <form className="wl" onSubmit={handleFormSubmit}>
              <input type="text" placeholder="First name" required />
              <input type="text" placeholder="Last name" required />
              <input type="email" placeholder="Work email" required className="full" />
              <input type="text" placeholder="Organization" required />
              <select required defaultValue="">
                <option value="" disabled>Your role</option>
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
                <option value="" disabled>Team size</option>
                <option>1–5</option>
                <option>6–15</option>
                <option>16–50</option>
                <option>51–100</option>
                <option>100+</option>
              </select>
              <select required className="full" defaultValue="">
                <option value="" disabled>Industry</option>
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
              <button type="submit" className="wl__btn">Apply for the Spring 2026 Pilot →</button>
            </form>
            <div className="wl__note">No credit card · Invite-only · One business day response</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer__inner">
            <div className="footer__brand">Scrybe<span>.</span></div>
            <div className="footer__links">
              <a href="#" className="footer__link">Privacy</a>
              <a href="#" className="footer__link">Terms</a>
              <a href="#" className="footer__link">Security</a>
              <a href="mailto:hello@scrybe.app" className="footer__link">Contact</a>
            </div>
            <div className="footer__copy">© 2026 Scrybe · Phoenixing LLC</div>
          </div>
        </div>
      </footer>
    </>
  );
}
