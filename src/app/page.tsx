"use client";

export default function HomePage() {
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector(".btn-primary") as HTMLButtonElement;
    if (btn) {
      btn.textContent = "You're on the list";
      btn.style.background = "var(--moss)";
      btn.disabled = true;
    }
  };

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

          --success: #3D7A63;
          --warning: #B0893B;
          --error: #A94A4A;
          --info: #4A6FA9;

          --font: "Inter", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;

          --r10: 10px;
          --r14: 14px;
          --r18: 18px;

          --shadow-sm: 0 8px 20px rgba(17,17,17,.06);
          --shadow-md: 0 12px 40px rgba(17,17,17,.08);

          --focus: 0 0 0 3px rgba(47,93,80,.20);

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
          gap: 12px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .mark {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          background: var(--ink);
          display: inline-block;
          position: relative;
        }
        .mark:after {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 6px;
          border: 2px solid rgba(250,250,248,.9);
          opacity: .95;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .nav-links a {
          color: var(--ink-70);
          font-size: 14px;
          padding: 8px 10px;
          border-radius: 999px;
        }
        .nav-links a:hover {
          background: rgba(231,229,224,.55);
          color: rgba(17,17,17,.90);
          text-decoration: none;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: var(--r10);
          font-weight: 600;
          font-size: 14px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform .06s ease, background-color .15s ease, border-color .15s ease, color .15s ease;
          user-select: none;
          white-space: nowrap;
        }
        .btn:active { transform: translateY(1px); }
        .btn-primary {
          background: var(--ink);
          color: var(--paper);
          border-color: rgba(17,17,17,.90);
        }
        .btn-primary:hover { background: rgba(17,17,17,.92); }
        .btn-secondary {
          background: transparent;
          color: var(--ink);
          border-color: rgba(17,17,17,.18);
        }
        .btn-secondary:hover {
          background: rgba(231,229,224,.55);
          border-color: rgba(17,17,17,.24);
        }

        /* Pills / badges */
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid var(--ink-12);
          background: rgba(250,250,248,.65);
          color: var(--ink-70);
          font-size: 13px;
        }
        .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--moss); }

        /* Hero */
        .hero {
          padding: 64px 0 48px;
        }
        .hero-card {
          border: 1px solid var(--ink-12);
          border-radius: var(--r18);
          padding: 48px 32px;
          background: linear-gradient(180deg, rgba(231,229,224,.60), rgba(250,250,248,0));
          box-shadow: var(--shadow-md);
          overflow: hidden;
          position: relative;
        }
        .hero-grid {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 980px) {
          .hero-grid { grid-template-columns: 1fr; }
          .hero-card { padding: 40px 24px; }
        }

        .landing-page h1 {
          font-size: 54px;
          line-height: 1.02;
          letter-spacing: -0.04em;
          margin: 16px 0 16px;
          font-weight: 800;
        }
        .subhead {
          font-size: 18px;
          color: var(--ink-70);
          margin: 0 0 24px;
          max-width: 70ch;
        }
        .cta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 16px;
        }
        .trust-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 24px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(17,17,17,.14);
          background: rgba(231,229,224,.35);
          font-size: 13px;
          color: var(--ink-80);
        }
        .badge .dot { width: 7px; height: 7px; }
        .badge.info .dot { background: var(--info); }
        .badge.success .dot { background: var(--success); }
        .badge.moss .dot { background: var(--moss); }

        /* Right-side preview */
        .preview {
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          background: rgba(250,250,248,.88);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .preview-top {
          padding: 14px 16px;
          border-bottom: 1px solid var(--ink-08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .preview-title {
          font-weight: 700;
          font-size: 13px;
          color: rgba(17,17,17,.78);
        }
        .preview-body {
          padding: 16px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .card-title {
          font-weight: 800;
          letter-spacing: -0.02em;
          font-size: 16px;
        }
        .meta {
          color: var(--ink-60);
          font-size: 12px;
          margin-top: 6px;
        }
        .divider { height: 1px; background: var(--ink-08); margin: 16px 0; }
        .small {
          font-size: 13px;
          color: var(--ink-70);
          line-height: 1.55;
        }

        /* Sections */
        section { padding: 48px 0; }
        .landing-page h2 {
          font-size: 28px;
          letter-spacing: -0.02em;
          margin: 0 0 12px;
          font-weight: 800;
        }
        .section-note {
          margin: 0 0 24px;
          color: var(--ink-70);
          max-width: 86ch;
        }

        .grid3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 980px) {
          .grid3, .grid2 { grid-template-columns: 1fr; }
        }

        .card {
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          background: rgba(250,250,248,.80);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }
        .kicker {
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--ink-60);
          margin-bottom: 8px;
        }
        .landing-page ul {
          margin: 8px 0 0;
          padding-left: 18px;
          color: var(--ink-80);
        }
        .landing-page li { margin: 6px 0; }

        /* Testimonials */
        .quote {
          font-size: 16px;
          color: rgba(17,17,17,.78);
          margin: 0;
        }
        .byline {
          margin-top: 12px;
          font-size: 13px;
          color: var(--ink-60);
        }

        /* Footer */
        .landing-footer {
          padding: 48px 0 64px;
          border-top: 1px solid var(--ink-08);
          color: var(--ink-60);
          font-size: 13px;
        }
        .footer-grid {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .footer-links {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .footer-links a { color: var(--ink-60); }
        .footer-links a:hover { color: rgba(17,17,17,.85); text-decoration: none; }

        @media (max-width: 600px) {
          .landing-page h1 { font-size: 36px; }
          .hero-card { padding: 32px 20px; }
        }
      `}</style>

      <div className="landing-page">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="mark" aria-hidden="true"></span>
              <span>SCRYBE</span>
            </div>

            <div className="nav-links" aria-label="Site navigation">
              <a href="#product">Product</a>
              <a href="#who">Who it&apos;s for</a>
              <a href="#trust">Trust</a>
              <a href="#faq">FAQ</a>
              <button
                className="btn btn-primary"
                onClick={() => document.getElementById("cta")?.scrollIntoView({ behavior: "smooth" })}
              >
                Request access
              </button>
            </div>
          </div>
        </div>

        <div className="wrap">
          {/* Hero */}
          <section className="hero" id="top">
            <div className="hero-card">
              <div className="hero-grid">
                <div>
                  <div className="pill">
                    <span className="dot"></span>Secure system of record
                  </div>
                  <h1>Memory that compounds.</h1>
                  <p className="subhead">
                    Capture conversations, cases, and outcomes in a calm workspace built for regulated environments.
                    Structured, searchable, and durable—so your records endure.
                  </p>

                  <form id="cta" className="cta-row" onSubmit={handleFormSubmit}>
                    <button type="submit" className="btn btn-primary">Start secure workspace</button>
                    <button type="button" className="btn btn-secondary">View example records</button>
                  </form>

                  <div className="trust-row">
                    <span className="badge info"><span className="dot"></span>Encrypted</span>
                    <span className="badge success"><span className="dot"></span>Audit-ready</span>
                    <span className="badge moss"><span className="dot"></span>HIPAA-adjacent</span>
                    <span className="badge"><span className="dot" style={{ background: "var(--gold)" }}></span>Retention by design</span>
                  </div>
                </div>

                <div className="preview" aria-label="Product preview">
                  <div className="preview-top">
                    <div className="preview-title">Example record</div>
                    <span className="badge success"><span className="dot"></span>Active</span>
                  </div>
                  <div className="preview-body">
                    <div className="row">
                      <div>
                        <div className="card-title">Client intake summary</div>
                        <div className="meta">Updated Feb 14, 2026 • Owner: You</div>
                      </div>
                      <span className="pill" style={{ padding: "6px 10px", fontSize: "12px" }}>
                        <span className="dot" style={{ background: "var(--info)" }}></span>Case
                      </span>
                    </div>
                    <div className="divider"></div>
                    <p className="small" style={{ margin: 0 }}>
                      Notes are structured with outcomes, actions, and timestamps—built for long-term clarity.
                    </p>
                    <div className="divider"></div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button className="btn btn-primary" style={{ padding: "10px 12px", fontSize: "13px" }}>Open</button>
                      <button className="btn btn-secondary" style={{ padding: "10px 12px", fontSize: "13px" }}>Share</button>
                      <button className="btn btn-secondary" style={{ padding: "10px 12px", fontSize: "13px" }}>Export</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Product */}
          <section id="product">
            <h2>Built for durable records</h2>
            <p className="section-note">
              SCRYBE treats notes like evidence: structured, timestamped, searchable, and designed to hold up over time.
              Calm UX by default. Clear outcomes. Predictable workflows.
            </p>

            <div className="grid3">
              <div className="card">
                <div className="kicker">Structure</div>
                <ul>
                  <li>Templates for cases, meetings, reports, and interviews</li>
                  <li>Outcomes, next steps, and ownership baked in</li>
                  <li>Consistent record formats across teams</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Retrieval</div>
                <ul>
                  <li>Search that respects context and sensitivity</li>
                  <li>Filters for time, category, owner, and status</li>
                  <li>Export formats designed for compliance</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Governance</div>
                <ul>
                  <li>Audit-ready logs and change history</li>
                  <li>Permissioned sharing and review states</li>
                  <li>Retention rules that match policy</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Who it's for */}
          <section id="who">
            <h2>Who SCRYBE is for</h2>
            <p className="section-note">
              Built for teams and individuals who need records they can rely on—without a loud interface.
            </p>

            <div className="grid3">
              <div className="card">
                <div className="kicker">Healthcare & regulated orgs</div>
                <ul>
                  <li>Case notes, protocols, and outcomes</li>
                  <li>Audit trails and secure access</li>
                  <li>Consistency across departments</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Nonprofits & social services</div>
                <ul>
                  <li>Client history and program tracking</li>
                  <li>Reporting that doesn&apos;t break privacy</li>
                  <li>Operational clarity for small teams</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Serious founders</div>
                <ul>
                  <li>Investor notes, interviews, decisions</li>
                  <li>Evidence-backed process</li>
                  <li>Long horizon documentation</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Trust */}
          <section id="trust">
            <h2>Trust is the product</h2>
            <p className="section-note">
              A system of record must feel safe before it is useful. SCRYBE is designed to communicate trust at every touchpoint.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Security posture</div>
                <ul>
                  <li>Encryption-first architecture (at rest + in transit)</li>
                  <li>Principle of least privilege for access</li>
                  <li>Clear, inspectable audit logs</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">UX posture</div>
                <ul>
                  <li>Neutral typography (Inter-only) to avoid &quot;marketing&quot; tone</li>
                  <li>Restraint in color: status ≠ decoration</li>
                  <li>Predictable patterns for high-stakes workflows</li>
                </ul>
              </div>
            </div>

            <div className="grid2" style={{ marginTop: "16px" }}>
              <div className="card">
                <div className="kicker">What people say</div>
                <p className="quote">&quot;This feels like software that&apos;s built to last—quiet, serious, and easy to trust.&quot;</p>
                <div className="byline">— Operations lead, regulated environment</div>
              </div>
              <div className="card">
                <div className="kicker">What people say</div>
                <p className="quote">&quot;Finally: a record system that&apos;s structured without feeling overwhelming.&quot;</p>
                <div className="byline">— Program manager, nonprofit services</div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq">
            <h2>FAQ</h2>
            <p className="section-note">
              Straight answers. No filler.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Is SCRYBE a notes app?</div>
                <p className="small" style={{ margin: 0 }}>
                  No. It&apos;s a system of record designed for durable documentation, structured outcomes, and governance.
                </p>
              </div>
              <div className="card">
                <div className="kicker">Can I use it in regulated environments?</div>
                <p className="small" style={{ margin: 0 }}>
                  That&apos;s the intent: security-first design, audit-ready patterns, and calm UX for high-stakes work.
                </p>
              </div>
              <div className="card">
                <div className="kicker">What&apos;s the first use case?</div>
                <p className="small" style={{ margin: 0 }}>
                  Case records and meeting notes with outcomes, ownership, and history—so teams can act with clarity.
                </p>
              </div>
              <div className="card">
                <div className="kicker">How do I get access?</div>
                <p className="small" style={{ margin: 0 }}>
                  Use the &quot;Request access&quot; button at the top. We&apos;ll reach out with next steps.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="landing-footer">
            <div className="footer-grid">
              <div>
                <div className="brand" style={{ gap: "10px" }}>
                  <span className="mark" aria-hidden="true"></span>
                  <span>SCRYBE</span>
                </div>
                <div style={{ marginTop: "10px", maxWidth: "60ch" }}>
                  Calm, enterprise-grade documentation for teams who need records that endure.
                </div>
              </div>
              <div className="footer-links">
                <a href="#product">Product</a>
                <a href="#who">Who it&apos;s for</a>
                <a href="#trust">Trust</a>
                <a href="#faq">FAQ</a>
                <a href="#top">Back to top</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
