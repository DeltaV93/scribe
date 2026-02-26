"use client";

export default function BrandingPage() {
  return (
    <>
      <style jsx global>{`
        .brand-page {
          /* INKRA Design System — 4-Color Pen */
          --paper: #FAFAF8;
          --paper-warm: #F5F4F0;
          --paper-dim: #EEEDEA;
          --ink: #111111;
          --ink-soft: #3A3A3A;
          --ink-muted: #6B6B6B;
          --ink-faint: #A1A1A1;
          --border: #DADAD7;
          --border-light: #E8E8E5;

          /* Ink Blue - Primary Accent */
          --ink-blue: #1B2A4A;
          --ink-blue-mid: #2F3A59;
          --ink-blue-light: #4A5A7A;
          --ink-blue-wash: rgba(27, 42, 74, 0.08);
          --ink-blue-ghost: rgba(27, 42, 74, 0.04);

          /* 4-Color Pen Functional Inks */
          --ink-red: #B34747;
          --ink-red-wash: rgba(179, 71, 71, 0.08);
          --ink-green: #3F6F5A;
          --ink-green-wash: rgba(63, 111, 90, 0.08);
          --ink-amber: #B26A00;
          --ink-amber-wash: rgba(178, 106, 0, 0.08);

          /* Typography */
          --font: "Inter", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          --mono: 'SF Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

          /* Radii */
          --radius-sm: 6px;
          --radius-md: 10px;
          --radius-lg: 14px;

          /* Shadows */
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
          --shadow-lg: 0 12px 40px rgba(0,0,0,0.08);

          /* Motion */
          --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
          --ease-soft: cubic-bezier(0.2, 0.8, 0.2, 1);
          --fast: 120ms;
          --normal: 240ms;

          --focus: 0 0 0 3px var(--ink-blue-wash);
          --max: 1120px;
        }

        .brand-page * { box-sizing: border-box; }
        .brand-page {
          margin: 0;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font);
          line-height: 1.6;
          min-height: 100vh;
        }

        .brand-page a { color: var(--ink-blue); text-decoration: none; }
        .brand-page a:hover { text-decoration: underline; }

        .brand-page .wrap {
          max-width: var(--max);
          margin: 0 auto;
          padding: 64px 24px 96px;
        }

        /* Hero badge */
        .brand-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-blue);
          background: var(--ink-blue-wash);
          padding: 6px 14px;
          border-radius: 999px;
          margin-bottom: 24px;
        }
        .brand-page .hero-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ink-blue);
        }

        /* Pills / chips */
        .brand-page .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--paper-warm);
          color: var(--ink-muted);
        }
        .brand-page .chip.blue {
          background: var(--ink-blue-wash);
          border-color: rgba(27, 42, 74, 0.20);
          color: var(--ink-blue);
        }
        .brand-page .chip.green {
          background: var(--ink-green-wash);
          border-color: rgba(63, 111, 90, 0.20);
          color: var(--ink-green);
        }
        .brand-page .chip.red {
          background: var(--ink-red-wash);
          border-color: rgba(179, 71, 71, 0.20);
          color: var(--ink-red);
        }
        .brand-page .chip.amber {
          background: var(--ink-amber-wash);
          border-color: rgba(178, 106, 0, 0.20);
          color: var(--ink-amber);
        }

        .brand-page h1 {
          font-size: 48px;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 16px 0;
          font-weight: 800;
        }
        .brand-page .subhead {
          font-size: 18px;
          color: var(--ink-soft);
          max-width: 600px;
          margin: 0 0 32px;
          line-height: 1.65;
        }

        .brand-page .hero {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          padding: 48px 32px;
          background: var(--paper-warm);
          box-shadow: var(--shadow-md);
          text-align: center;
        }

        .brand-page .nav {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border-light);
          justify-content: center;
        }
        .brand-page .nav a {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-muted);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          transition: all var(--fast) var(--ease-out);
        }
        .brand-page .nav a:hover {
          color: var(--ink);
          background: var(--ink-blue-ghost);
          text-decoration: none;
        }

        .brand-page .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .brand-page .grid3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .brand-page .grid4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 960px) {
          .brand-page h1 { font-size: 36px; }
          .brand-page .grid2, .brand-page .grid3, .brand-page .grid4 { grid-template-columns: 1fr; }
          .brand-page .hero { padding: 40px 24px; }
        }

        .brand-page section { margin-top: 80px; }

        .brand-page h2 {
          font-size: 32px;
          letter-spacing: -0.025em;
          margin: 0 0 12px;
          font-weight: 700;
          line-height: 1.2;
        }
        .brand-page h3 {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.015em;
          line-height: 1.3;
          margin-bottom: 8px;
        }
        .brand-page h4 {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
        }
        .brand-page .section-note {
          color: var(--ink-soft);
          margin: 0 0 24px;
          max-width: 640px;
          line-height: 1.65;
        }

        .brand-page .card {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          background: var(--paper-warm);
          padding: 24px;
          transition: all var(--normal) var(--ease-out);
        }
        .brand-page .card:hover {
          box-shadow: var(--shadow-md);
        }

        .brand-page .label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 12px;
        }

        .brand-page .list { margin: 8px 0 0; padding-left: 18px; color: var(--ink-soft); }
        .brand-page .list li { margin: 6px 0; }

        /* Buttons */
        .brand-page .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--fast) var(--ease-out);
          font-family: var(--font);
        }
        .brand-page .btn:active { transform: translateY(1px); }
        .brand-page .btn-primary {
          background: var(--ink-blue);
          color: #fff;
          border-color: var(--ink-blue);
          box-shadow: 0 1px 3px rgba(27,42,74,0.20);
        }
        .brand-page .btn-primary:hover {
          background: var(--ink-blue-mid);
          box-shadow: 0 4px 12px rgba(27,42,74,0.25);
          transform: translateY(-1px);
        }
        .brand-page .btn-secondary {
          background: var(--paper-warm);
          color: var(--ink);
          border-color: var(--border);
        }
        .brand-page .btn-secondary:hover {
          border-color: var(--ink-blue);
          color: var(--ink-blue);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }
        .brand-page .btn-ghost {
          background: transparent;
          color: var(--ink-blue);
          border-color: transparent;
        }
        .brand-page .btn-ghost:hover {
          background: var(--ink-blue-ghost);
        }
        .brand-page .btn-danger {
          background: var(--ink-red-wash);
          color: var(--ink-red);
          border-color: rgba(179, 71, 71, 0.20);
        }
        .brand-page .btn-danger:hover {
          background: rgba(179, 71, 71, 0.12);
        }

        /* Ink dot accent */
        .brand-page .ink-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.5;
        }
        .brand-page .btn:hover .ink-dot { opacity: 1; }

        /* Status dots */
        .brand-page .status-dot {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        .brand-page .status-dot::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .brand-page .status-dot.blue::before { background: var(--ink-blue); box-shadow: 0 0 0 3px var(--ink-blue-wash); }
        .brand-page .status-dot.green::before { background: var(--ink-green); box-shadow: 0 0 0 3px var(--ink-green-wash); }
        .brand-page .status-dot.red::before { background: var(--ink-red); box-shadow: 0 0 0 3px var(--ink-red-wash); }
        .brand-page .status-dot.amber::before { background: var(--ink-amber); box-shadow: 0 0 0 3px var(--ink-amber-wash); }

        /* Form controls */
        .brand-page .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .brand-page .input-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-soft);
        }
        .brand-page input, .brand-page textarea, .brand-page select {
          font-family: var(--font);
          font-size: 14px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--paper);
          color: var(--ink);
          outline: none;
          transition: all var(--fast) var(--ease-out);
        }
        .brand-page input:hover, .brand-page textarea:hover, .brand-page select:hover {
          border-color: color-mix(in srgb, var(--ink-blue) 40%, var(--border));
        }
        .brand-page input:focus, .brand-page textarea:focus, .brand-page select:focus {
          border-color: var(--ink-blue);
          box-shadow: var(--focus);
        }
        .brand-page input::placeholder { color: var(--ink-faint); }
        .brand-page textarea { min-height: 100px; resize: vertical; }

        .brand-page .divider { height: 1px; background: var(--border-light); margin: 16px 0; }

        /* Swatches */
        .brand-page .swatches {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 16px;
        }
        @media (max-width: 960px) { .brand-page .swatches { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        .brand-page .swatch {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .brand-page .swatch-color { height: 100px; }
        .brand-page .swatch-info {
          padding: 12px 14px;
          background: var(--paper-warm);
        }
        .brand-page .swatch-name { font-size: 13px; font-weight: 600; }
        .brand-page .swatch-hex { font-size: 12px; color: var(--ink-muted); font-family: var(--mono); }

        /* Type scale */
        .brand-page .typeRow {
          display: grid;
          grid-template-columns: 100px 1fr 100px;
          gap: 16px;
          align-items: baseline;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-light);
        }
        .brand-page .typeRow:last-child { border-bottom: 0; }
        .brand-page .typeName { font-size: 13px; color: var(--ink-muted); }
        .brand-page .typeSpec { font-size: 12px; color: var(--ink-faint); text-align: right; font-family: var(--mono); }
        .brand-page .t-display { font-size: 48px; line-height: 1.1; font-weight: 800; letter-spacing: -0.03em; }
        .brand-page .t-h1 { font-size: 32px; line-height: 1.2; font-weight: 700; letter-spacing: -0.025em; }
        .brand-page .t-h2 { font-size: 18px; line-height: 1.3; font-weight: 700; letter-spacing: -0.015em; }
        .brand-page .t-body { font-size: 14px; line-height: 1.65; font-weight: 400; color: var(--ink-soft); }
        .brand-page .t-label { font-size: 11px; line-height: 1.25; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }

        /* Code block */
        .brand-page .code-block {
          background: var(--paper-dim);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 16px 18px;
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.7;
          overflow-x: auto;
          white-space: pre;
          color: var(--ink-soft);
        }
        .brand-page .code-key { color: var(--ink-blue); }
        .brand-page .code-val { color: var(--ink-green); }
        .brand-page .code-comment { color: var(--ink-faint); }

        /* Usage ratio bar */
        .brand-page .ratio-bar {
          display: flex;
          height: 40px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--border-light);
        }

        .brand-page footer {
          margin-top: 96px;
          padding-top: 24px;
          border-top: 1px solid var(--border-light);
          color: var(--ink-muted);
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
            <div className="hero-badge">Conversation-to-Work Platform</div>

            <h1>Inkra Design System</h1>
            <p className="subhead" style={{ margin: "0 auto 32px" }}>
              The complete brand, UI, and design token reference for Inkra.
              Everything your team needs to build, market, and scale.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn btn-primary"><span className="ink-dot" style={{ background: "#fff" }}></span> Start with tokens</button>
              <a href="#colors" className="btn btn-secondary">Colors</a>
              <a href="#type" className="btn btn-secondary">Typography</a>
              <a href="#components" className="btn btn-ghost">Components</a>
            </div>

            <nav className="nav" aria-label="Sections">
              <a href="#strategy">Strategy</a>
              <a href="#colors">Colors</a>
              <a href="#type">Typography</a>
              <a href="#buttons">Buttons</a>
              <a href="#inputs">Inputs</a>
              <a href="#components">Components</a>
              <a href="#tokens">Tokens</a>
            </nav>
          </header>

          <section id="strategy">
            <h4>01 — Brand Strategy</h4>
            <h2>Inkra turns conversations into structured work automatically.</h2>
            <p className="section-note">
              So teams can focus on the work instead of documenting it. Inkra captures what matters — from VoIP calls, standups, user research sessions, patient visits, and client intake — and routes it into forms, tasks, reports, and compliance records without manual effort.
            </p>

            <div className="grid3">
              <div className="card">
                <h3>Category</h3>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginTop: "8px" }}>Conversation-to-Work Platform</p>
                <p className="t-body" style={{ marginTop: "12px" }}>Not a transcription tool. Not a meeting bot. Not a CRM. Inkra is the AI layer that sits inside conversations and automates the work that follows.</p>
              </div>
              <div className="card">
                <h3>Core Idea</h3>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginTop: "8px" }}>Work shouldn't disappear into conversations.</p>
                <p className="t-body" style={{ marginTop: "12px" }}>Teams spend hours talking, explaining, discussing, reporting. The real work happens after. Inkra bridges that gap automatically.</p>
              </div>
              <div className="card">
                <h3>Brand Personality</h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                  <span className="chip blue">Protective</span>
                  <span className="chip blue">Intelligent</span>
                  <span className="chip blue">Warm</span>
                  <span className="chip blue">Institutional</span>
                  <span className="chip blue">Trustworthy</span>
                </div>
              </div>
            </div>
          </section>

          <section id="colors">
            <h4>02 — Color System</h4>
            <h2>The 4-Color Pen</h2>
            <p className="section-note">
              Inkra's color system is inspired by the classic multi-ink pen. Each color carries semantic meaning. Blue for interaction, black for content, red for attention, green for confirmation.
            </p>

            <div className="card" style={{ marginBottom: "24px" }}>
              <div className="label">Core Palette</div>
              <div className="swatches" style={{ marginTop: "12px" }}>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#FAFAF8", borderBottom: "1px solid #E8E8E5" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Paper</div><div className="swatch-hex">#FAFAF8</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#111111" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Ink</div><div className="swatch-hex">#111111</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#1B2A4A" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Ink Blue</div><div className="swatch-hex">#1B2A4A</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#DADAD7", borderBottom: "1px solid #ccc" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Border</div><div className="swatch-hex">#DADAD7</div></div>
                </div>
              </div>

              <div className="label" style={{ marginTop: "24px" }}>Functional Inks (4-Color Pen)</div>
              <div className="swatches" style={{ marginTop: "12px" }}>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#1B2A4A" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Blue — Actions & Links</div><div className="swatch-hex">#1B2A4A</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#B34747" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Red — Errors & Alerts</div><div className="swatch-hex">#B34747</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#3F6F5A" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Green — Success & Done</div><div className="swatch-hex">#3F6F5A</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#B26A00" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Amber — Warnings</div><div className="swatch-hex">#B26A00</div></div>
                </div>
              </div>

              <div className="label" style={{ marginTop: "24px" }}>Usage Ratio</div>
              <div className="ratio-bar" style={{ marginTop: "8px" }}>
                <div style={{ flex: 80, background: "#FAFAF8" }}></div>
                <div style={{ flex: 12, background: "#1B2A4A" }}></div>
                <div style={{ flex: 3, background: "#3F6F5A" }}></div>
                <div style={{ flex: 3, background: "#B34747" }}></div>
                <div style={{ flex: 2, background: "#B26A00" }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12px", color: "var(--ink-muted)" }}>
                <span>80% Neutrals</span><span>12% Blue</span><span>3% Green</span><span>3% Red</span><span>2% Amber</span>
              </div>
            </div>
          </section>

          <section id="type">
            <h4>03 — Typography</h4>
            <h2>Inter — One Family, Clear Hierarchy</h2>
            <p className="section-note">
              Inter is the sole typeface. Hierarchy comes from weight and size, not font diversity. This keeps Inkra feeling institutional, not decorative.
            </p>

            <div className="card">
              <div className="typeRow">
                <div className="typeName">Display</div>
                <div className="t-display">Headline</div>
                <div className="typeSpec">48 / 800</div>
              </div>
              <div className="typeRow">
                <div className="typeName">H1</div>
                <div className="t-h1">Section heading</div>
                <div className="typeSpec">32 / 700</div>
              </div>
              <div className="typeRow">
                <div className="typeName">H2</div>
                <div className="t-h2">Card title / Subsection</div>
                <div className="typeSpec">18 / 700</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Body</div>
                <div className="t-body">Body text reads at 14px for product interfaces. Comfortable for extended reading in dashboards.</div>
                <div className="typeSpec">14 / 400</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Label</div>
                <div className="t-label">SECTION LABEL</div>
                <div className="typeSpec">11 / 600</div>
              </div>
            </div>
          </section>

          <section id="buttons">
            <h4>04 — Buttons</h4>
            <h2>Buttons</h2>
            <p className="section-note">
              Clean, calm, institutional. The ink-dot accent is a subtle signature — it appears on primary CTAs as a small visual anchor.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Primary Actions</div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="btn btn-primary"><span className="ink-dot" style={{ background: "#fff" }}></span> Request Access</button>
                  <button className="btn btn-primary">Start Recording</button>
                  <button className="btn btn-primary" style={{ padding: "7px 14px", fontSize: "13px" }}>Save</button>
                </div>
              </div>
              <div className="card">
                <div className="label">Secondary & Ghost</div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary">Review</button>
                  <button className="btn btn-secondary" style={{ padding: "7px 14px", fontSize: "13px" }}>Export</button>
                  <button className="btn btn-ghost">Undo</button>
                  <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "13px" }}>Cancel</button>
                </div>
              </div>
              <div className="card">
                <div className="label">Functional</div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="btn btn-danger" style={{ padding: "7px 14px", fontSize: "13px" }}>Delete Record</button>
                  <button className="btn btn-secondary" style={{ borderColor: "var(--ink-green)", color: "var(--ink-green)" }}>Approve</button>
                  <button className="btn btn-secondary" style={{ borderColor: "var(--ink-amber)", color: "var(--ink-amber)" }}>Review Required</button>
                </div>
              </div>
              <div className="card">
                <div className="label">Status System</div>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  <span className="status-dot blue">Recording</span>
                  <span className="status-dot green">Completed</span>
                  <span className="status-dot amber">Review needed</span>
                  <span className="status-dot red">Paused</span>
                </div>
              </div>
            </div>
          </section>

          <section id="inputs">
            <h4>05 — Inputs & Forms</h4>
            <h2>Writing Surfaces</h2>
            <p className="section-note">
              Inputs should feel like document fields, not web forms. Clean borders, ink-blue focus state, gentle transition.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="field">
                  <label className="input-label">Workspace Name</label>
                  <input placeholder="e.g. Family Assistance Program" />
                </div>
                <div className="field" style={{ marginTop: "16px" }}>
                  <label className="input-label">Search</label>
                  <input placeholder="Search conversations, people, records..." />
                </div>
                <div className="field" style={{ marginTop: "16px" }}>
                  <label className="input-label">Notes</label>
                  <textarea placeholder="Add context that travels with the record..."></textarea>
                </div>
              </div>
              <div className="card">
                <div className="label">Tags & Chips</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span className="chip">Default</span>
                  <span className="chip blue">Active</span>
                  <span className="chip green">Verified</span>
                  <span className="chip red">Blocked</span>
                  <span className="chip amber">Pending</span>
                </div>
              </div>
            </div>
          </section>

          <section id="components">
            <h4>06 — Components</h4>
            <h2>Product Components</h2>
            <p className="section-note">
              The building blocks of the Inkra product. Every component follows the same principles: calm, structured, institutional.
            </p>

            <div className="card">
              <div className="label">What Inkra Never Does</div>
              <div className="grid2" style={{ marginTop: "12px" }}>
                <div style={{ padding: "16px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "var(--paper)" }}>
                  <p className="t-body">Uses "AI-powered" as a headline. The technology is invisible — sell the outcome.</p>
                </div>
                <div style={{ padding: "16px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "var(--paper)" }}>
                  <p className="t-body">Uses neon gradients, robot imagery, glowing particles, or anything that screams "AI startup."</p>
                </div>
                <div style={{ padding: "16px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "var(--paper)" }}>
                  <p className="t-body">Makes the UI feel busy. Inkra products feel like a quiet office, not a mission control dashboard.</p>
                </div>
                <div style={{ padding: "16px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "var(--paper)" }}>
                  <p className="t-body">Uses exclamation marks in product copy. Calm confidence, not enthusiasm.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="tokens">
            <h4>07 — Design Tokens</h4>
            <h2>Engineering Reference</h2>
            <p className="section-note">
              Copy-paste ready CSS custom properties and token values for implementation.
            </p>

            <div className="card">
              <div className="label">Color Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`/* Inkra Color Tokens */
--paper:        #FAFAF8;
--paper-warm:   #F5F4F0;
--paper-dim:    #EEEDEA;
--ink:          #111111;
--ink-soft:     #3A3A3A;
--ink-muted:    #6B6B6B;
--ink-faint:    #A1A1A1;
--border:       #DADAD7;
--border-light: #E8E8E5;

/* Ink Blue (Primary) */
--ink-blue:       #1B2A4A;
--ink-blue-mid:   #2F3A59;
--ink-blue-wash:  rgba(27, 42, 74, 0.08);

/* Functional Inks (4-Color Pen) */
--ink-red:        #B34747;   /* errors, alerts */
--ink-green:      #3F6F5A;   /* success, complete */
--ink-amber:      #B26A00;   /* warnings, review */`}
              </div>

              <div className="label" style={{ marginTop: "24px" }}>Motion Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`/* Inkra Motion */
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
--ease-soft: cubic-bezier(0.2, 0.8, 0.2, 1);
--fast:      120ms;   /* hover, focus */
--normal:    240ms;   /* transitions */
--slow:      600ms;   /* page transitions */`}
              </div>

              <div className="label" style={{ marginTop: "24px" }}>Shadow & Radius Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`--shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-md: 0 4px 12px rgba(0,0,0,0.06);
--shadow-lg: 0 12px 40px rgba(0,0,0,0.08);

--radius-sm: 6px;    /* chips, small elements */
--radius-md: 10px;   /* buttons, inputs */
--radius-lg: 14px;   /* cards, modals */`}
              </div>
            </div>
          </section>

          <footer>
            <div>Inkra Design System • Conversation-to-Work Platform • v1</div>
            <div><a href="#top">Back to top</a></div>
          </footer>
        </div>
      </div>
    </>
  );
}
