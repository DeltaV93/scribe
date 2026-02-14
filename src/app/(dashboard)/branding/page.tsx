"use client";

export default function BrandingPage() {
  return (
    <>
      <style jsx global>{`
        .brand-page {
          --ink: #111111;
          --paper: #FAFAF8;
          --stone: #E7E5E0;
          --moss: #2F5D50;
          --gold: #C2A86B;

          --ink-90: rgba(17,17,17,.90);
          --ink-80: rgba(17,17,17,.80);
          --ink-70: rgba(17,17,17,.70);
          --ink-60: rgba(17,17,17,.60);
          --ink-50: rgba(17,17,17,.50);
          --ink-20: rgba(17,17,17,.20);
          --ink-12: rgba(17,17,17,.12);
          --ink-08: rgba(17,17,17,.08);

          --success: #3D7A63;
          --warning: #B0893B;
          --error: #A94A4A;
          --info: #4A6FA9;

          --font: "Inter", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;

          --r8: 8px;
          --r10: 10px;
          --r12: 12px;
          --r14: 14px;
          --r18: 18px;

          --shadow-sm: 0 8px 20px rgba(17,17,17,.06);
          --shadow-md: 0 12px 40px rgba(17,17,17,.08);

          --focus: 0 0 0 3px rgba(47,93,80,.20);

          --max: 1120px;
        }

        .brand-page * { box-sizing: border-box; }
        .brand-page {
          margin: 0;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font);
          line-height: 1.55;
          min-height: 100vh;
        }

        .brand-page a { color: var(--moss); text-decoration: none; }
        .brand-page a:hover { text-decoration: underline; }

        .brand-page .wrap {
          max-width: var(--max);
          margin: 0 auto;
          padding: 64px 24px 96px;
        }

        /* Eyebrow / pills */
        .brand-page .eyebrow {
          font-size: 12px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--ink-60);
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .brand-page .pill {
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
        .brand-page .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--moss); }

        .brand-page h1 {
          font-size: 52px;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin: 16px 0 16px;
          font-weight: 800;
        }
        .brand-page .subhead {
          font-size: 18px;
          color: var(--ink-70);
          max-width: 72ch;
          margin: 0 0 32px;
        }

        .brand-page .hero {
          border: 1px solid var(--ink-12);
          border-radius: var(--r18);
          padding: 48px 32px;
          background: linear-gradient(180deg, rgba(231,229,224,.60), rgba(250,250,248,0));
          box-shadow: var(--shadow-md);
          overflow: hidden;
          position: relative;
        }

        .brand-page .nav {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--ink-12);
        }
        .brand-page .nav a {
          font-size: 14px;
          color: var(--ink-70);
          padding: 8px 10px;
          border-radius: 999px;
        }
        .brand-page .nav a:hover {
          background: rgba(231,229,224,.55);
          color: var(--ink-90);
          text-decoration: none;
        }

        .brand-page .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .brand-page .grid3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 960px) {
          .brand-page h1 { font-size: 44px; }
          .brand-page .grid2, .brand-page .grid3 { grid-template-columns: 1fr; }
          .brand-page .hero { padding: 40px 24px; }
        }

        .brand-page section { margin-top: 64px; }

        .brand-page h2 {
          font-size: 28px;
          letter-spacing: -0.02em;
          margin: 0 0 12px;
          font-weight: 800;
        }
        .brand-page .section-note {
          color: var(--ink-70);
          margin: 0 0 24px;
          max-width: 90ch;
        }

        .brand-page .card {
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          background: rgba(250,250,248,.80);
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .brand-page .kicker {
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--ink-60);
          margin-bottom: 8px;
        }

        .brand-page .list { margin: 8px 0 0; padding-left: 18px; color: var(--ink-80); }
        .brand-page .list li { margin: 6px 0; }

        /* Buttons */
        .brand-page .btn {
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
        }
        .brand-page .btn:active { transform: translateY(1px); }
        .brand-page .btnPrimary {
          background: var(--ink);
          color: var(--paper);
          border-color: rgba(17,17,17,.90);
        }
        .brand-page .btnPrimary:hover { background: rgba(17,17,17,.92); }
        .brand-page .btnSecondary {
          background: transparent;
          color: var(--ink);
          border-color: rgba(17,17,17,.18);
        }
        .brand-page .btnSecondary:hover {
          background: rgba(231,229,224,.55);
          border-color: rgba(17,17,17,.24);
        }
        .brand-page .btnQuiet {
          background: rgba(231,229,224,.40);
          color: var(--ink);
          border-color: rgba(17,17,17,.10);
        }
        .brand-page .btnQuiet:hover { background: rgba(231,229,224,.55); }

        .brand-page .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .brand-page label {
          font-size: 12px;
          color: var(--ink-70);
          font-weight: 600;
          letter-spacing: .01em;
        }
        .brand-page input, .brand-page textarea, .brand-page select {
          font-family: var(--font);
          font-size: 14px;
          padding: 12px 12px;
          border-radius: var(--r10);
          border: 1px solid rgba(17,17,17,.18);
          background: rgba(250,250,248,.95);
          color: var(--ink);
          outline: none;
        }
        .brand-page input:focus, .brand-page textarea:focus, .brand-page select:focus {
          border-color: rgba(47,93,80,.55);
          box-shadow: var(--focus);
        }
        .brand-page textarea { min-height: 92px; resize: vertical; }

        .brand-page .badge {
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
        .brand-page .badge .dot { width: 7px; height: 7px; }
        .brand-page .badge.success .dot { background: var(--success); }
        .brand-page .badge.warning .dot { background: var(--warning); }
        .brand-page .badge.error .dot { background: var(--error); }
        .brand-page .badge.info .dot { background: var(--info); }

        .brand-page .divider { height: 1px; background: var(--ink-12); margin: 16px 0; }

        /* Swatches */
        .brand-page .swatches {
          display: grid;
          grid-template-columns: repeat(5, minmax(0,1fr));
          gap: 16px;
        }
        @media (max-width: 960px) { .brand-page .swatches { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        .brand-page .swatch {
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          overflow: hidden;
          background: rgba(250,250,248,.85);
        }
        .brand-page .chip { height: 70px; }
        .brand-page .meta {
          padding: 12px 14px 14px;
          font-size: 13px;
          color: var(--ink-70);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .brand-page .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

        /* Type scale */
        .brand-page .typeRow {
          display: grid;
          grid-template-columns: 90px 1fr 90px;
          gap: 16px;
          align-items: baseline;
          padding: 12px 0;
          border-bottom: 1px solid var(--ink-08);
        }
        .brand-page .typeRow:last-child { border-bottom: 0; }
        .brand-page .typeName { font-size: 13px; color: var(--ink-60); }
        .brand-page .typeSpec { font-size: 12px; color: var(--ink-50); text-align: right; }
        .brand-page .t-h1 { font-size: 52px; line-height: 1.05; font-weight: 800; letter-spacing: -0.03em; }
        .brand-page .t-h2 { font-size: 36px; line-height: 1.10; font-weight: 800; letter-spacing: -0.02em; }
        .brand-page .t-h3 { font-size: 24px; line-height: 1.18; font-weight: 800; letter-spacing: -0.015em; }
        .brand-page .t-h4 { font-size: 18px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; }
        .brand-page .t-bodyL { font-size: 18px; line-height: 1.6; font-weight: 400; }
        .brand-page .t-body { font-size: 16px; line-height: 1.6; font-weight: 400; }
        .brand-page .t-small { font-size: 14px; line-height: 1.55; font-weight: 400; }
        .brand-page .t-label { font-size: 12px; line-height: 1.25; font-weight: 600; letter-spacing: .01em; }

        /* Layout examples */
        .brand-page .example {
          border: 1px solid var(--ink-12);
          border-radius: var(--r14);
          padding: 24px;
          background: rgba(250,250,248,.90);
        }
        .brand-page .exampleTop {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .brand-page .exampleTitle {
          font-weight: 800;
          letter-spacing: -0.02em;
          font-size: 20px;
        }
        .brand-page .exampleMeta {
          color: var(--ink-60);
          font-size: 13px;
          margin-top: 6px;
        }

        .brand-page footer {
          margin-top: 96px;
          padding-top: 24px;
          border-top: 1px solid var(--ink-12);
          color: var(--ink-60);
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
      `}</style>

      <div className="brand-page">
        <div className="wrap">
          <header className="hero" id="top">
            <div className="eyebrow">
              <span className="pill"><span className="dot"></span>Inter-only • Enterprise tone</span>
              <span className="pill"><span className="dot" style={{ background: "var(--gold)" }}></span>Calm infrastructure palette</span>
              <span className="pill"><span className="dot" style={{ background: "var(--info)" }}></span>Design System V1</span>
            </div>

            <h1>SCRYBE Design System</h1>
            <p className="subhead">
              (Chris Do lens) If it&apos;s not clear, it&apos;s not premium. If it&apos;s not consistent, it&apos;s not trustworthy.
              This system is built to feel inevitable: quiet, durable, and credible in regulated spaces.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <a href="#tokens" className="btn btnPrimary">Start with tokens</a>
              <a href="#type" className="btn btnSecondary">Typography</a>
              <a href="#components" className="btn btnSecondary">Components</a>
              <a href="#examples" className="btn btnQuiet">UI examples</a>
            </div>

            <nav className="nav" aria-label="Sections">
              <a href="#positioning">Positioning</a>
              <a href="#tokens">Tokens</a>
              <a href="#colors">Colors</a>
              <a href="#type">Type scale</a>
              <a href="#spacing">Spacing</a>
              <a href="#components">Components</a>
              <a href="#content">Voice & UI copy</a>
              <a href="#examples">Examples</a>
            </nav>
          </header>

          <section id="positioning">
            <h2>Brand positioning</h2>
            <p className="section-note">
              SCRYBE is not &quot;a notes app.&quot; It&apos;s a <strong>system of record</strong>.
              Your visual system must signal: calm authority, data safety, and permanence.
              We do that with: neutrality (Inter), restraint (no decoration), and consistency (tokens).
            </p>

            <div className="grid3">
              <div className="card">
                <div className="kicker">Promise</div>
                <div className="t-h4">Memory that compounds.</div>
                <ul className="list">
                  <li>Capture → organize → retrieve.</li>
                  <li>Designed for long horizons (years, not weeks).</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Tone</div>
                <ul className="list">
                  <li><strong>Calm</strong> (no visual noise)</li>
                  <li><strong>Trustworthy</strong> (predictable patterns)</li>
                  <li><strong>Permanent</strong> (archival palette)</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Avoid</div>
                <ul className="list">
                  <li>Neon AI gradients</li>
                  <li>Playful rounded branding</li>
                  <li>Over-designed typography pairings</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="tokens">
            <h2>Design tokens</h2>
            <p className="section-note">
              This is the backbone. Tokens make decisions for you, so the product stays consistent even as the team grows.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Type</div>
                <div className="pill"><span className="dot"></span><span className="mono">--font: Inter</span></div>
                <div className="divider"></div>
                <div className="kicker">Radii</div>
                <div className="pill"><span className="dot"></span><span className="mono">8 / 10 / 12 / 14 / 18</span></div>
                <div className="divider"></div>
                <div className="kicker">Shadows</div>
                <div className="pill"><span className="dot"></span><span className="mono">sm / md (subtle)</span></div>
              </div>

              <div className="card">
                <div className="kicker">Spacing scale</div>
                <p style={{ margin: 0, color: "var(--ink-70)" }}>
                  Base: <span className="mono">8px</span> with micro: <span className="mono">4px</span> and <span className="mono">2px</span>.
                  Use: <span className="mono">4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96</span>.
                </p>
                <div className="divider"></div>
                <div className="kicker">Interaction</div>
                <p style={{ margin: 0, color: "var(--ink-70)" }}>
                  Focus state uses Deep Moss ring: <span className="mono">--focus</span>. Motion is minimal; feedback is immediate.
                </p>
              </div>
            </div>
          </section>

          <section id="colors">
            <h2>Color system</h2>
            <p className="section-note">
              Calm comes from restraint. Use Deep Moss sparingly as an accent, not a paint bucket.
            </p>

            <div className="card">
              <div className="kicker">Core palette</div>
              <div className="swatches" style={{ marginTop: "12px" }}>
                <div className="swatch">
                  <div className="chip" style={{ background: "var(--ink)" }}></div>
                  <div className="meta">
                    <strong>Archive Black</strong>
                    <span className="mono">#111111</span>
                    <span>Primary actions, text, logo</span>
                  </div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: "var(--paper)" }}></div>
                  <div className="meta">
                    <strong>Paper Warm</strong>
                    <span className="mono">#FAFAF8</span>
                    <span>Background, calm surfaces</span>
                  </div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: "var(--stone)" }}></div>
                  <div className="meta">
                    <strong>Soft Stone</strong>
                    <span className="mono">#E7E5E0</span>
                    <span>Borders, dividers, panels</span>
                  </div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: "var(--moss)" }}></div>
                  <div className="meta">
                    <strong>Deep Moss</strong>
                    <span className="mono">#2F5D50</span>
                    <span>Links, focus, subtle highlights</span>
                  </div>
                </div>
                <div className="swatch">
                  <div className="chip" style={{ background: "var(--gold)" }}></div>
                  <div className="meta">
                    <strong>Muted Gold</strong>
                    <span className="mono">#C2A86B</span>
                    <span>Rare premium moments</span>
                  </div>
                </div>
              </div>

              <div className="kicker" style={{ marginTop: "22px" }}>Semantic colors</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                <span className="badge success"><span className="dot"></span>Success</span>
                <span className="badge warning"><span className="dot"></span>Warning</span>
                <span className="badge error"><span className="dot"></span>Error</span>
                <span className="badge info"><span className="dot"></span>Info</span>
              </div>
              <p style={{ margin: "12px 0 0", color: "var(--ink-70)" }}>
                Rule: semantic colors are for <strong>status</strong>, not decoration.
              </p>
            </div>
          </section>

          <section id="type">
            <h2>Typography</h2>
            <p className="section-note">
              Inter-only = enterprise signal. The hierarchy comes from weight, size, and spacing — not from switching fonts.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Type scale</div>

                <div className="typeRow">
                  <div className="typeName">H1</div>
                  <div className="t-h1">Memory that compounds.</div>
                  <div className="typeSpec">52 / 800</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">H2</div>
                  <div className="t-h2">Records that endure.</div>
                  <div className="typeSpec">36 / 800</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">H3</div>
                  <div className="t-h3">Quiet authority.</div>
                  <div className="typeSpec">24 / 800</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">H4</div>
                  <div className="t-h4">Designed for regulated work.</div>
                  <div className="typeSpec">18 / 700</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">Body L</div>
                  <div className="t-bodyL">Capture, structure, and retrieve outcomes without visual noise.</div>
                  <div className="typeSpec">18 / 400</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">Body</div>
                  <div className="t-body">Built for healthcare, nonprofits, and serious founders.</div>
                  <div className="typeSpec">16 / 400</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">Small</div>
                  <div className="t-small">Audit-ready. Calm defaults. Predictable interactions.</div>
                  <div className="typeSpec">14 / 400</div>
                </div>
                <div className="typeRow">
                  <div className="typeName">Label</div>
                  <div className="t-label">Case status</div>
                  <div className="typeSpec">12 / 600</div>
                </div>
              </div>

              <div className="card">
                <div className="kicker">Do/Don&apos;t (Chris Do)</div>
                <ul className="list">
                  <li><strong>Do:</strong> create contrast with scale + weight + whitespace.</li>
                  <li><strong>Do:</strong> keep line length ~60–80 characters for body.</li>
                  <li><strong>Don&apos;t:</strong> add a &quot;fancy heading font&quot; to feel premium.</li>
                  <li><strong>Don&apos;t:</strong> rely on color for hierarchy — use typography first.</li>
                </ul>
                <div className="divider"></div>
                <div className="kicker">Default text styles</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span className="pill"><span className="dot"></span>Body: 16/400</span>
                  <span className="pill"><span className="dot"></span>Labels: 12/600</span>
                  <span className="pill"><span className="dot"></span>Buttons: 14/600</span>
                </div>
              </div>
            </div>
          </section>

          <section id="spacing">
            <h2>Spacing & layout</h2>
            <p className="section-note">
              Premium is space. Enterprise is consistency. The grid keeps the product calm even when the content is complex.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Layout rules</div>
                <ul className="list">
                  <li>Max content width: <span className="mono">1120px</span></li>
                  <li>Cards: padding <span className="mono">24px</span> (minimum)</li>
                  <li>Section separation: <span className="mono">64px</span></li>
                  <li>Dense screens: use <span className="mono">16px</span> gutters, never less</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Spacing scale quick view</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>8</span><div style={{ height: "10px", width: "8px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>16</span><div style={{ height: "10px", width: "16px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>24</span><div style={{ height: "10px", width: "24px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>32</span><div style={{ height: "10px", width: "32px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>48</span><div style={{ height: "10px", width: "48px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span className="mono" style={{ width: "56px", color: "var(--ink-60)" }}>64</span><div style={{ height: "10px", width: "64px", background: "var(--ink)", borderRadius: "999px" }}></div></div>
                </div>
              </div>
            </div>
          </section>

          <section id="components">
            <h2>Component library</h2>
            <p className="section-note">
              Components should feel like &quot;quiet tools.&quot; No drama. Clear states. Predictable behavior.
            </p>

            <div className="grid3">
              <div className="card">
                <div className="kicker">Buttons</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="btn btnPrimary">Primary</button>
                  <button className="btn btnSecondary">Secondary</button>
                  <button className="btn btnQuiet">Quiet</button>
                </div>
                <div className="divider"></div>
                <div className="kicker">Badges</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span className="badge success"><span className="dot"></span>Active</span>
                  <span className="badge info"><span className="dot"></span>Encrypted</span>
                  <span className="badge warning"><span className="dot"></span>Review</span>
                  <span className="badge error"><span className="dot"></span>Issue</span>
                </div>
              </div>

              <div className="card">
                <div className="kicker">Form controls</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="field">
                    <label htmlFor="t1">Record title</label>
                    <input id="t1" type="text" defaultValue="Client intake summary" />
                  </div>
                  <div className="field">
                    <label htmlFor="t2">Category</label>
                    <select id="t2" defaultValue="Case">
                      <option>Case</option>
                      <option>Meeting</option>
                      <option>Report</option>
                      <option>Interview</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="kicker">Textarea</div>
                <div className="field">
                  <label htmlFor="t3">Notes</label>
                  <textarea id="t3" defaultValue="Structured notes. Clear outcomes. Calm defaults."></textarea>
                </div>
                <div className="divider"></div>
                <div className="kicker">Link style</div>
                <p style={{ margin: 0, color: "var(--ink-70)" }}>Links are understated: <a href="#">View audit log</a></p>
              </div>
            </div>
          </section>

          <section id="content">
            <h2>Voice & UI copy</h2>
            <p className="section-note">
              Enterprise copy is not &quot;fun.&quot; It&apos;s <strong>clear</strong>. If the user has to re-read it, we failed.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Voice principles</div>
                <ul className="list">
                  <li><strong>Short</strong> sentences.</li>
                  <li><strong>Concrete</strong> nouns and verbs.</li>
                  <li><strong>No</strong> metaphors in UI.</li>
                  <li><strong>Calm</strong> reassurance for sensitive flows.</li>
                </ul>
              </div>
              <div className="card">
                <div className="kicker">Example microcopy</div>
                <ul className="list">
                  <li>Primary CTA: <strong>Start secure workspace</strong></li>
                  <li>Secondary CTA: <strong>View example records</strong></li>
                  <li>Empty state: <strong>No records yet.</strong> Create your first record to begin.</li>
                  <li>Error: <strong>Couldn&apos;t save.</strong> Check your connection and try again.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="examples">
            <h2>UI examples</h2>
            <p className="section-note">
              This is where it clicks. Same tokens, same components — applied to real screens.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="kicker">Landing hero preview</div>
                <div className="example">
                  <div className="eyebrow" style={{ marginBottom: "12px" }}>
                    <span className="pill"><span className="dot"></span>SCRYBE</span>
                    <span className="pill"><span className="dot" style={{ background: "var(--info)" }}></span>Secure system of record</span>
                  </div>
                  <div className="t-h2" style={{ marginBottom: "10px" }}>Memory that compounds.</div>
                  <div className="t-bodyL" style={{ color: "var(--ink-70)", marginBottom: "16px" }}>
                    Capture conversations, cases, and outcomes in a calm workspace built for regulated environments.
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button className="btn btnPrimary">Start secure workspace</button>
                    <button className="btn btnSecondary">View example records</button>
                  </div>
                  <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <span className="badge info"><span className="dot"></span>Encrypted</span>
                    <span className="badge success"><span className="dot"></span>Audit-ready</span>
                    <span className="badge"><span className="dot"></span>HIPAA-adjacent</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="kicker">Record card preview</div>
                <div className="example">
                  <div className="exampleTop">
                    <div>
                      <div className="exampleTitle">Client intake summary</div>
                      <div className="exampleMeta">Updated Feb 14, 2026 • Owner: You</div>
                    </div>
                    <span className="badge success"><span className="dot"></span>Active</span>
                  </div>
                  <div className="divider"></div>
                  <div className="t-small" style={{ color: "var(--ink-70)" }}>
                    Notes are structured, searchable, and durable—built for regulated workflows and serious documentation.
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button className="btn btnPrimary">Open record</button>
                    <button className="btn btnSecondary">Share</button>
                    <button className="btn btnQuiet">Export</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer>
            <div>SCRYBE Design System • Inter-only • Calm infrastructure palette</div>
            <div><a href="#top">Back to top ↑</a></div>
          </footer>
        </div>
      </div>
    </>
  );
}
