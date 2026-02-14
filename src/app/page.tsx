"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <style jsx global>{`
        :root {
          --ink: #111111;
          --paper: #FAFAF8;
          --stone: #E7E5E0;
          --moss: #2F5D50;
          --gold: #C2A86B;

          --ink-80: rgba(17,17,17,.80);
          --ink-70: rgba(17,17,17,.70);
          --ink-60: rgba(17,17,17,.60);
          --ink-12: rgba(17,17,17,.12);
          --ink-08: rgba(17,17,17,.08);

          --font: "Inter", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;

          --r10: 10px;
          --r14: 14px;
          --r18: 18px;

          --shadow-sm: 0 8px 20px rgba(17,17,17,.06);
          --shadow-md: 0 12px 40px rgba(17,17,17,.08);

          --max: 1120px;
        }

        * { box-sizing: border-box; }

        .landing-page {
          font-family: var(--font);
          background: var(--paper);
          color: var(--ink);
          line-height: 1.55;
          min-height: 100vh;
        }

        a { color: var(--moss); text-decoration: none; }
        a:hover { text-decoration: underline; }

        .wrap { max-width: var(--max); margin: 0 auto; padding: 0 24px; }

        /* Top nav */
        .topbar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(250,250,248,.85);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--ink-08);
        }
        .topbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 24px;
          max-width: var(--max);
          margin: 0 auto;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.01em;
          color: var(--ink);
          text-decoration: none;
        }
        .brand:hover { text-decoration: none; }
        .mark {
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

        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .nav-links a {
          color: var(--ink-70);
          font-size: 14px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: 8px;
          text-decoration: none;
        }
        .nav-links a:hover {
          background: rgba(231,229,224,.55);
          color: var(--ink);
          text-decoration: none;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          border-radius: var(--r10);
          font-weight: 600;
          font-size: 14px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform .06s ease, background-color .15s ease, border-color .15s ease;
          user-select: none;
          white-space: nowrap;
          text-decoration: none;
        }
        .btn:hover { text-decoration: none; }
        .btn:active { transform: translateY(1px); }
        .btn-primary {
          background: var(--ink);
          color: var(--paper);
          border-color: var(--ink);
        }
        .btn-primary:hover { background: rgba(17,17,17,.85); }
        .btn-secondary {
          background: transparent;
          color: var(--ink);
          border-color: var(--ink-12);
        }
        .btn-secondary:hover {
          background: rgba(231,229,224,.55);
          border-color: rgba(17,17,17,.24);
        }
        .btn-cta {
          background: var(--ink);
          color: var(--paper);
          padding: 16px 32px;
          font-size: 16px;
          border-radius: var(--r10);
        }
        .btn-cta:hover { background: rgba(17,17,17,.85); }

        /* Hero */
        .hero {
          padding: 96px 0 80px;
          text-align: center;
        }
        .landing-page h1 {
          font-size: 56px;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin: 0 0 24px;
          font-weight: 800;
        }
        .landing-page h1 .highlight {
          color: var(--moss);
        }
        .hero-sub {
          font-size: 20px;
          color: var(--ink-70);
          margin: 0 auto 40px;
          max-width: 600px;
          line-height: 1.5;
        }
        .hero-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        @media (max-width: 768px) {
          .hero { padding: 64px 0 56px; }
          .landing-page h1 { font-size: 36px; }
          .hero-sub { font-size: 17px; }
        }

        /* Features */
        .features {
          padding: 64px 0 80px;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        @media (max-width: 1000px) {
          .features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr; }
        }

        .feature-card {
          background: rgba(250,250,248,.95);
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          padding: 28px 24px;
          box-shadow: var(--shadow-sm);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(231,229,224,.5);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: var(--ink-70);
        }
        .feature-icon svg {
          width: 24px;
          height: 24px;
          stroke: currentColor;
          stroke-width: 1.5;
          fill: none;
        }
        .feature-card h3 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 12px;
          color: var(--ink);
        }
        .feature-card p {
          font-size: 15px;
          color: var(--ink-70);
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .feature-card ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .feature-card li {
          font-size: 14px;
          color: var(--ink-70);
          padding: 6px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .feature-card li::before {
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--moss);
          flex-shrink: 0;
        }

        /* CTA Section */
        .cta-section {
          padding: 80px 0;
        }
        .cta-card {
          background: var(--ink);
          border-radius: var(--r18);
          padding: 64px 48px;
          text-align: center;
          box-shadow: var(--shadow-md);
        }
        .cta-card h2 {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--paper);
          margin: 0 0 16px;
        }
        .cta-card p {
          font-size: 18px;
          color: rgba(250,250,248,.7);
          margin: 0 auto 32px;
          max-width: 500px;
          line-height: 1.5;
        }
        .cta-card .btn-cta {
          background: var(--paper);
          color: var(--ink);
        }
        .cta-card .btn-cta:hover {
          background: rgba(250,250,248,.9);
        }

        @media (max-width: 600px) {
          .cta-card { padding: 48px 24px; }
          .cta-card h2 { font-size: 28px; }
        }

        /* Footer */
        .landing-footer {
          padding: 48px 0;
          border-top: 1px solid var(--ink-08);
        }
        .footer-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footer-copy {
          font-size: 14px;
          color: var(--ink-60);
        }
        .footer-links {
          display: flex;
          gap: 24px;
        }
        .footer-links a {
          font-size: 14px;
          color: var(--ink-60);
        }
        .footer-links a:hover {
          color: var(--ink);
          text-decoration: none;
        }

        @media (max-width: 600px) {
          .footer-inner {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>

      <div className="landing-page">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="mark">S</span>
              <span>Scrybe</span>
            </Link>

            <div className="nav-links">
              <Link href="/login">Sign In</Link>
              <Link href="/signup" className="btn btn-primary">Get Started</Link>
            </div>
          </div>
        </div>

        {/* Hero */}
        <section className="hero">
          <div className="wrap">
            <h1>
              AI-Powered Case Management<br />
              for <span className="highlight">Social Services</span>
            </h1>
            <p className="hero-sub">
              Streamline intake forms, automate data extraction from calls, and focus on what matters most—helping your clients.
            </p>
            <div className="hero-buttons">
              <Link href="/signup" className="btn btn-primary">Start Free Trial</Link>
              <button className="btn btn-secondary">Watch Demo</button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="features">
          <div className="wrap">
            <div className="features-grid">
              {/* Smart Form Builder */}
              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3>Smart Form Builder</h3>
                <p>Create intake forms with AI-powered field extraction and conditional logic.</p>
                <ul>
                  <li>Drag-and-drop field builder</li>
                  <li>12+ field types</li>
                  <li>Visual conditional logic</li>
                  <li>Multi-language support</li>
                </ul>
              </div>

              {/* Call Recording */}
              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <h3>Call Recording</h3>
                <p>Record client calls with real-time AI-powered transcription.</p>
                <ul>
                  <li>VoIP calling</li>
                  <li>Live transcription</li>
                  <li>Speaker identification</li>
                  <li>Secure storage</li>
                </ul>
              </div>

              {/* AI Extraction */}
              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3>AI Extraction</h3>
                <p>Automatically extract form data from call transcripts using Claude AI.</p>
                <ul>
                  <li>Claude-powered extraction</li>
                  <li>Confidence scoring</li>
                  <li>Custom examples (RAG)</li>
                  <li>Manual review flags</li>
                </ul>
              </div>

              {/* Compliance Ready */}
              <div className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3>Compliance Ready</h3>
                <p>Built for grant compliance with immutable audit logs and encryption.</p>
                <ul>
                  <li>Hash-chain audit logs</li>
                  <li>7-year retention</li>
                  <li>Envelope encryption</li>
                  <li>WCAG 2.1 AAA</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="wrap">
            <div className="cta-card">
              <h2>Ready to transform your workflow?</h2>
              <p>
                Join organizations already saving hours on case documentation with Scrybe&apos;s AI-powered platform.
              </p>
              <Link href="/signup" className="btn btn-cta">Start Your Free Trial</Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="wrap">
            <div className="footer-inner">
              <div className="footer-brand">
                <span className="mark">S</span>
                <span style={{ fontWeight: 700 }}>Scrybe</span>
              </div>
              <div className="footer-copy">
                © 2026 Scrybe Solutions. All rights reserved.
              </div>
              <div className="footer-links">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
