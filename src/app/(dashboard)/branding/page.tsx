"use client";

export default function BrandingPage() {
  return (
    <>
      <style jsx global>{`
        /* Brand color tokens - scoped to branding page */
        .brand-page {
          --obsidian: #0c0c0e;
          --copper: #c4956a;
          --copper-text: #7d5a36;
          --copper-cta: #8a5c32;
          --copper-light: #d4b48a;
          --copper-dark: #996b42;
          --steel: #8a8578;
          --muted-brand: #6b6659;
          --bone: #ede8df;
          --graphite: #2a2a2e;
          --white: #f8f6f2;
          --success-brand: #2e6b4f;
          --error-brand: #a8433c;
          --info-brand: #4a6a8c;
          /* Use the Next.js loaded fonts via CSS variables */
          --brand-serif: var(--font-serif), Georgia, serif;
          --brand-sans: var(--font-sans-brand), system-ui, sans-serif;
          --brand-mono: var(--font-mono), monospace;
        }

        .brand-page * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .brand-page {
          background: #fafaf7;
          color: #1a1a1a;
          font-family: var(--brand-sans);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }
        .brand-page img {
          max-width: 100%;
          display: block;
        }

        /* NAV */
        .brand-page .toc-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(250, 250, 247, 0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid #e0ddd6;
          padding: 0 24px;
        }
        .brand-page .toc-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          height: 52px;
          gap: 16px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .brand-page .toc-logo {
          font-family: var(--brand-serif);
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .brand-page .toc-logo span {
          color: var(--copper-text);
          margin-left: 4px;
        }
        .brand-page .toc-links {
          display: flex;
          gap: 2px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .brand-page .toc-links a {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--muted-brand);
          padding: 6px 10px;
          border-radius: 6px;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .brand-page .toc-links a:hover {
          color: #333;
          background: rgba(0, 0, 0, 0.04);
        }

        /* LAYOUT */
        .brand-page .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .brand-page section {
          padding: 56px 0;
          border-bottom: 1px solid #e8e5de;
        }
        .brand-page section:last-child {
          border-bottom: none;
        }
        @media (max-width: 700px) {
          .brand-page section {
            padding: 36px 0;
          }
        }

        /* TYPOGRAPHY */
        .brand-page .sec-num {
          font-family: var(--brand-mono);
          font-size: 11px;
          font-weight: 500;
          color: var(--copper-text);
          letter-spacing: 0.1em;
          margin-bottom: 6px;
          display: block;
        }
        .brand-page .sec-title {
          font-family: var(--brand-serif);
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 600;
          line-height: 1.1;
          color: #1a1a1a;
          margin-bottom: 12px;
        }
        .brand-page .sec-desc {
          font-size: 16px;
          color: #666;
          max-width: 60ch;
          line-height: 1.7;
          margin-bottom: 28px;
        }

        .brand-page h3 {
          font-family: var(--brand-serif);
          font-size: 22px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 10px;
          line-height: 1.2;
        }
        .brand-page .label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--muted-brand);
          margin-bottom: 8px;
        }
        .brand-page .body-text {
          font-size: 15px;
          color: #555;
          line-height: 1.7;
          max-width: 60ch;
        }
        .brand-page .caption {
          font-family: var(--brand-mono);
          font-size: 11px;
          color: var(--muted-brand);
        }

        /* CARDS */
        .brand-page .card {
          background: #fff;
          border: 1px solid #e0ddd6;
          border-radius: 16px;
          overflow: hidden;
        }
        .brand-page .card-pad {
          padding: 24px;
        }
        .brand-page .card-head {
          padding: 20px 24px;
          border-bottom: 1px solid #eeebe4;
        }
        .brand-page .card-head h3 {
          margin-bottom: 0;
        }

        /* GRIDS */
        .brand-page .g2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .brand-page .g3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
        }
        .brand-page .g4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 800px) {
          .brand-page .g2,
          .brand-page .g3,
          .brand-page .g4 {
            grid-template-columns: 1fr;
          }
        }

        /* COVER */
        .brand-page .cover {
          background: var(--obsidian);
          color: var(--white);
          padding: 80px 24px;
          position: relative;
          overflow: hidden;
        }
        .brand-page .cover-inner {
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }
        .brand-page .cover-kicker {
          font-family: var(--brand-mono);
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--copper);
          margin-bottom: 20px;
        }
        .brand-page .cover h1 {
          font-family: var(--brand-serif);
          font-size: clamp(36px, 6vw, 64px);
          font-weight: 600;
          line-height: 1.05;
          margin-bottom: 16px;
          max-width: 14ch;
        }
        .brand-page .cover h1 em {
          font-style: normal;
          color: var(--copper);
        }
        .brand-page .cover-sub {
          font-size: 18px;
          color: rgba(248, 246, 242, 0.6);
          max-width: 50ch;
          line-height: 1.65;
          margin-bottom: 24px;
        }
        .brand-page .cover-meta {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          font-family: var(--brand-mono);
          font-size: 11px;
          color: rgba(248, 246, 242, 0.4);
        }
        .brand-page .cover-threads {
          position: absolute;
          inset: 0;
          overflow: hidden;
          opacity: 0.3;
        }
        .brand-page .cover-threads svg {
          position: absolute;
          right: -10%;
          top: -10%;
          width: 70%;
          height: 120%;
        }

        /* SWATCHES */
        .brand-page .swatch-lg {
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #e0ddd6;
        }
        .brand-page .swatch-lg .chip {
          height: 80px;
        }
        .brand-page .swatch-lg .info {
          padding: 12px 14px;
        }
        .brand-page .swatch-lg .info .name {
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
          margin-bottom: 2px;
        }
        .brand-page .swatch-lg .info .hex {
          font-family: var(--brand-mono);
          font-size: 11px;
          color: var(--muted-brand);
        }
        .brand-page .swatch-lg .info .role {
          font-size: 12px;
          color: var(--muted-brand);
          margin-top: 4px;
        }

        .brand-page .swatch-sm {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #eeebe4;
        }
        .brand-page .swatch-sm .dot {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          flex-shrink: 0;
          border: 1px solid rgba(0, 0, 0, 0.08);
        }
        .brand-page .swatch-sm .meta {
          font-size: 12px;
        }
        .brand-page .swatch-sm .meta strong {
          color: #1a1a1a;
          display: block;
        }
        .brand-page .swatch-sm .meta span {
          color: var(--muted-brand);
          font-family: var(--brand-mono);
          font-size: 10px;
        }

        /* RATIO BAR */
        .brand-page .ratio-bar {
          display: flex;
          border-radius: 10px;
          overflow: hidden;
          height: 40px;
          border: 1px solid #e0ddd6;
        }
        .brand-page .ratio-bar div {
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        /* TYPE SPECIMEN */
        .brand-page .type-card {
          padding: 28px;
          border-radius: 14px;
          border: 1px solid #eeebe4;
          background: #faf9f5;
          margin-bottom: 16px;
        }
        .brand-page .type-card:last-child {
          margin-bottom: 0;
        }
        .brand-page .type-card .sample {
          margin: 10px 0 8px;
          color: #1a1a1a;
        }
        .brand-page .type-card .notes {
          font-size: 12px;
          color: var(--muted-brand);
          line-height: 1.6;
        }

        /* MARK BOXES */
        .brand-page .mark-cell {
          aspect-ratio: 1;
          border-radius: 14px;
          border: 1px solid #e0ddd6;
          display: grid;
          place-items: center;
          position: relative;
        }
        .brand-page .mark-cell .ml {
          position: absolute;
          bottom: 8px;
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* DARK SPECIMEN */
        .brand-page .dark-spec {
          background: var(--obsidian);
          color: var(--white);
          border-radius: 16px;
          padding: 36px;
          border: 1px solid #e0ddd6;
        }
        .brand-page .dark-spec h3 {
          color: var(--white);
        }

        /* LIGHT SPECIMEN */
        .brand-page .light-spec {
          background: var(--bone);
          color: #1a1a1a;
          border-radius: 16px;
          padding: 36px;
          border: 1px solid #e0ddd6;
        }

        /* DO/DONT */
        .brand-page .do-box {
          padding: 18px;
          border-radius: 12px;
          background: #f0f7f2;
          border: 1px solid #c8e0cc;
        }
        .brand-page .dont-box {
          padding: 18px;
          border-radius: 12px;
          background: #fdf2f2;
          border: 1px solid #e8c8c8;
        }
        .brand-page .do-box h4 {
          color: #2d6a4f;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .brand-page .dont-box h4 {
          color: #993333;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .brand-page .do-box li,
        .brand-page .dont-box li {
          font-size: 13px;
          color: #555;
          margin-bottom: 4px;
          list-style: none;
          padding-left: 16px;
          position: relative;
          line-height: 1.5;
        }
        .brand-page .do-box li::before {
          content: "\u2713";
          position: absolute;
          left: 0;
          color: #2d6a4f;
          font-weight: 700;
        }
        .brand-page .dont-box li::before {
          content: "\u2715";
          position: absolute;
          left: 0;
          color: #993333;
          font-weight: 700;
        }

        /* RULE BOX */
        .brand-page .rule {
          padding: 16px 20px;
          border-radius: 10px;
          border-left: 3px solid var(--copper);
          background: #faf9f5;
          font-size: 14px;
          color: #444;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .brand-page .rule strong {
          color: #1a1a1a;
        }

        /* UI MOCK */
        .brand-page .ui-frame {
          border: 1px solid #e0ddd6;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
        }
        .brand-page .ui-bar {
          height: 38px;
          border-bottom: 1px solid #eeebe4;
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 6px;
        }
        .brand-page .ui-bar .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .brand-page .ui-bar span {
          font-size: 11px;
          color: var(--muted-brand);
          font-weight: 600;
        }
        .brand-page .ui-content {
          padding: 16px;
        }

        /* MOTION */
        @keyframes fadeUp {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }
        @keyframes threadAnim {
          0% {
            stroke-dashoffset: 300;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .brand-page .anim-fade {
          animation: fadeUp 1.2s ease infinite alternate;
        }
        .brand-page .anim-pulse {
          animation: pulse 2.2s ease infinite;
        }

        /* VERTICAL CARDS */
        .brand-page .vert {
          padding: 18px;
          border-radius: 12px;
          border: 1px solid #eeebe4;
          background: #faf9f5;
        }
        .brand-page .vert .vert-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--copper-text);
          margin-bottom: 6px;
          font-family: var(--brand-sans);
        }
        .brand-page .vert .vert-hl {
          font-family: var(--brand-serif);
          font-size: 18px;
          line-height: 1.2;
          color: #1a1a1a;
          margin-bottom: 4px;
        }
        .brand-page .vert .vert-sub {
          font-size: 12px;
          color: var(--muted-brand);
          font-family: var(--brand-sans);
        }

        /* TABLE */
        .brand-page .spec-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .brand-page .spec-table th {
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted-brand);
          font-weight: 700;
          padding: 8px 12px;
          border-bottom: 2px solid #e0ddd6;
        }
        .brand-page .spec-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #eeebe4;
          color: #444;
        }
        .brand-page .spec-table td:first-child {
          font-weight: 600;
          color: #1a1a1a;
        }
        .brand-page .spec-table tr:last-child td {
          border-bottom: none;
        }

        /* BADGE */
        .brand-page .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .brand-page .badge-copper {
          background: rgba(196, 149, 106, 0.12);
          color: var(--copper-text);
        }
        .brand-page .badge-green {
          background: rgba(45, 106, 79, 0.08);
          color: #2d6a4f;
        }
        .brand-page .badge-gray {
          background: #f0ede6;
          color: #666;
        }

        /* FOOTER */
        .brand-page .brand-footer {
          background: var(--obsidian);
          color: rgba(248, 246, 242, 0.4);
          padding: 48px 24px;
          font-size: 12px;
        }
        .brand-page .brand-footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .brand-page .brand-footer .logo {
          font-family: var(--brand-serif);
          font-size: 20px;
          color: var(--white);
          font-weight: 600;
        }
        .brand-page .brand-footer .logo span {
          color: var(--copper);
        }
      `}</style>

      <div className="brand-page">
        {/* COVER */}
        <div className="cover">
          <div className="cover-threads">
            <svg viewBox="0 0 600 500" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="1" y2=".5">
                  <stop offset="0" stopColor="#C4956A" stopOpacity="0" />
                  <stop offset=".5" stopColor="#C4956A" stopOpacity=".6" />
                  <stop offset="1" stopColor="#C4956A" stopOpacity=".05" />
                </linearGradient>
              </defs>
              <g fill="none" stroke="url(#cg)" strokeWidth="1.5">
                <path d="M-20,400 C120,280 200,240 340,240 C500,240 540,140 620,80" />
                <path d="M-20,360 C140,260 220,280 360,280 C500,280 560,180 620,140" />
                <path d="M-20,320 C120,220 240,200 360,200 C520,200 560,100 620,40" />
                <path d="M-20,440 C140,340 260,340 380,340 C520,340 580,260 620,220" />
                <path d="M-20,280 C100,180 240,160 380,160 C540,160 580,60 620,0" />
              </g>
            </svg>
          </div>
          <div className="cover-inner">
            <div className="cover-kicker">Brand Identity Guide - v1.0</div>
            <h1>
              Obsidian <em>Signal</em>
            </h1>
            <p className="cover-sub">
              The complete visual identity system for Scrybe - The Relationship
              System of Record. This guide defines how the brand looks, speaks,
              moves, and feels across every touchpoint.
            </p>
            <div className="cover-meta">
              <span>Prepared for: Scrybe / Phoenixing LLC</span>
              <span>Date: February 2026</span>
              <span>Status: Active</span>
            </div>
          </div>
        </div>

        <div className="page">
          {/* 01. BRAND OVERVIEW */}
          <section id="overview">
            <span className="sec-num">01</span>
            <h2 className="sec-title">Brand Overview</h2>
            <p className="sec-desc">
              Scrybe is building the Relationship System of Record - not another
              AI notetaker. This brand system defines how Scrybe will be
              perceived, positioned, and differentiated in a market flooded with
              AI transcription tools and meeting assistants.
            </p>

            <div className="g2" style={{ marginBottom: "24px" }}>
              <div>
                <h3>Positioning</h3>
                <p className="body-text">
                  Scrybe creates a new category:{" "}
                  <strong>Relationship System of Record</strong>. A secure
                  memory layer that makes client relationships compound over
                  time. Not notes. Not transcripts. Not sales coaching. The
                  system that knows what your organization knows about every
                  client.
                </p>
              </div>
              <div>
                <h3>The Brand Direction</h3>
                <p className="body-text">
                  <strong>Obsidian Signal</strong> - high-contrast editorial
                  authority with copper-warm intelligence. The palette signals
                  permanence and institutional memory. Copper is what happens
                  when metal survives time, which is Scrybe&apos;s value
                  proposition made visual.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-pad">
                <div className="label">Primary Message Stack</div>
                <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                  <div
                    style={{
                      fontFamily: "var(--brand-mono)",
                      fontSize: "11px",
                      color: "var(--copper-text)",
                      fontWeight: 500,
                    }}
                  >
                    TAGLINE
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "28px",
                      fontWeight: 600,
                      lineHeight: 1.1,
                      color: "#1a1a1a",
                    }}
                  >
                    The Relationship System of Record
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--brand-mono)",
                      fontSize: "11px",
                      color: "var(--copper-text)",
                      fontWeight: 500,
                      marginTop: "8px",
                    }}
                  >
                    STRAPLINE
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "20px",
                      fontWeight: 400,
                      color: "#555",
                    }}
                  >
                    Context during calls. Continuity across years.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 02. COLOR SYSTEM */}
          <section id="color">
            <span className="sec-num">02</span>
            <h2 className="sec-title">Color System</h2>
            <p className="sec-desc">
              The Obsidian Signal palette communicates permanence, institutional
              trust, and warm intelligence. Every color has a specific job and
              usage boundary.
            </p>

            <h3>Primary Palette</h3>
            <div className="g3" style={{ margin: "20px 0 28px" }}>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--obsidian)" }}
                ></div>
                <div className="info">
                  <div className="name">Obsidian</div>
                  <div className="hex">#0C0C0E - RGB 12, 12, 14</div>
                  <div className="role">
                    Primary surface. Dark mode backgrounds. Depth and gravity.
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--copper)" }}
                ></div>
                <div className="info">
                  <div className="name">Burnished Copper</div>
                  <div className="hex">#C4956A - RGB 196, 149, 106</div>
                  <div className="role">
                    Decorative accent. Convergence Mark. Tinted backgrounds.
                    Borders. Not for text on light surfaces - use Copper Text
                    instead.
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--bone)" }}
                ></div>
                <div className="info">
                  <div className="name">Bone</div>
                  <div className="hex">#EDE8DF - RGB 237, 232, 223</div>
                  <div className="role">
                    Light mode surface. Marketing. Print. Warmth.
                  </div>
                </div>
              </div>
            </div>

            <h3>Supporting Palette</h3>
            <div className="g3" style={{ margin: "20px 0 28px" }}>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--graphite)" }}
                ></div>
                <div className="info">
                  <div className="name">Graphite Wash</div>
                  <div className="hex">#2A2A2E - RGB 42, 42, 46</div>
                  <div className="role">
                    Card surfaces. Secondary containers. Elevated dark elements.
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--steel)" }}
                ></div>
                <div className="info">
                  <div className="name">Warm Steel</div>
                  <div className="hex">#8A8578 - RGB 138, 133, 120</div>
                  <div className="role">
                    Borders. Dividers. Non-text decorative elements. For
                    readable muted text, use Muted Text (#6B6659).
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div
                  className="chip"
                  style={{ background: "var(--white)" }}
                ></div>
                <div className="info">
                  <div className="name">Signal White</div>
                  <div className="hex">#F8F6F2 - RGB 248, 246, 242</div>
                  <div className="role">
                    Primary text on dark. Headlines. Never use pure #FFF.
                  </div>
                </div>
              </div>
            </div>

            <h3>Accessible Text Tokens</h3>
            <p className="body-text" style={{ marginBottom: "16px" }}>
              These tokens ensure WCAG 2.1 AA compliance for text on light and
              CTA surfaces. Use these instead of Burnished Copper or Warm Steel
              whenever text must be readable.
            </p>
            <div className="g3" style={{ margin: "20px 0 28px" }}>
              <div className="swatch-lg">
                <div className="chip" style={{ background: "#7D5A36" }}></div>
                <div className="info">
                  <div className="name">Copper Text</div>
                  <div className="hex">#7D5A36 - RGB 125, 90, 54</div>
                  <div className="role">
                    Readable copper on Bone/White. Section numbers, kickers,
                    badge text, links. 5.08:1 on Bone.
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div className="chip" style={{ background: "#8A5C32" }}></div>
                <div className="info">
                  <div className="name">Copper CTA</div>
                  <div className="hex">#8A5C32 - RGB 138, 92, 50</div>
                  <div className="role">
                    Button backgrounds with white text. Primary actions. 5.74:1
                    for white text.
                  </div>
                </div>
              </div>
              <div className="swatch-lg">
                <div className="chip" style={{ background: "#6B6659" }}></div>
                <div className="info">
                  <div className="name">Muted Text</div>
                  <div className="hex">#6B6659 - RGB 107, 102, 89</div>
                  <div className="role">
                    Captions, timestamps, secondary labels on light backgrounds.
                    4.69:1 on Bone.
                  </div>
                </div>
              </div>
            </div>

            <div className="rule">
              <strong>Accessibility rule:</strong> Burnished Copper (#C4956A)
              achieves AAA on Obsidian (7.31:1) but fails on light surfaces
              (2.19:1 on Bone). On light backgrounds, always use Copper Text
              (#7D5A36) for readable text and Copper CTA (#8A5C32) for button
              backgrounds. Warm Steel (#8A8578) is for non-text elements only -
              use Muted Text (#6B6659) for readable secondary text.
            </div>

            <h3>Extended Palette</h3>
            <p className="body-text" style={{ marginBottom: "16px" }}>
              Functional colors for UI states. Use sparingly and always in
              combination with the primary palette.
            </p>
            <div className="g4" style={{ marginBottom: "28px" }}>
              <div className="swatch-sm">
                <div className="dot" style={{ background: "#2E6B4F" }}></div>
                <div className="meta">
                  <strong>Success</strong>
                  <span>#2E6B4F</span>
                </div>
              </div>
              <div className="swatch-sm">
                <div className="dot" style={{ background: "#A8433C" }}></div>
                <div className="meta">
                  <strong>Error</strong>
                  <span>#A8433C</span>
                </div>
              </div>
              <div className="swatch-sm">
                <div className="dot" style={{ background: "#C4956A" }}></div>
                <div className="meta">
                  <strong>Warning</strong>
                  <span>#C4956A (Copper)</span>
                </div>
              </div>
              <div className="swatch-sm">
                <div className="dot" style={{ background: "#4A6A8C" }}></div>
                <div className="meta">
                  <strong>Info</strong>
                  <span>#4A6A8C</span>
                </div>
              </div>
            </div>

            <h3>Color Ratios</h3>
            <p className="body-text" style={{ marginBottom: "16px" }}>
              Copper is a highlight ink - never the dominant surface color.
              These ratios maintain brand gravity.
            </p>
            <div className="g2" style={{ marginBottom: "20px" }}>
              <div>
                <div className="label">Dark Mode</div>
                <div className="ratio-bar">
                  <div
                    style={{
                      flex: 60,
                      background: "var(--obsidian)",
                      color: "rgba(248,246,242,.5)",
                    }}
                  >
                    60%
                  </div>
                  <div
                    style={{
                      flex: 20,
                      background: "var(--graphite)",
                      color: "rgba(248,246,242,.5)",
                    }}
                  >
                    20%
                  </div>
                  <div
                    style={{ flex: 10, background: "var(--bone)", color: "#666" }}
                  >
                    10%
                  </div>
                  <div
                    style={{
                      flex: 10,
                      background: "var(--copper)",
                      color: "#fff",
                    }}
                  >
                    10%
                  </div>
                </div>
              </div>
              <div>
                <div className="label">Light Mode</div>
                <div className="ratio-bar">
                  <div
                    style={{ flex: 55, background: "var(--bone)", color: "#666" }}
                  >
                    55%
                  </div>
                  <div
                    style={{ flex: 20, background: "#fff", color: "#6B6659" }}
                  >
                    20%
                  </div>
                  <div
                    style={{
                      flex: 15,
                      background: "var(--obsidian)",
                      color: "rgba(248,246,242,.5)",
                    }}
                  >
                    15%
                  </div>
                  <div
                    style={{
                      flex: 10,
                      background: "var(--copper)",
                      color: "#fff",
                    }}
                  >
                    10%
                  </div>
                </div>
              </div>
            </div>

            <div className="g2">
              <div className="do-box">
                <h4>Do</h4>
                <ul style={{ padding: 0 }}>
                  <li>Use Copper at &le;10% of any layout</li>
                  <li>
                    Use Copper Text (#7D5A36) for any copper text on light
                    backgrounds
                  </li>
                  <li>
                    Use Copper CTA (#8A5C32) for button backgrounds with white
                    text
                  </li>
                  <li>
                    Use Muted Text (#6B6659) for captions and secondary text
                  </li>
                  <li>
                    Use Burnished Copper (#C4956A) freely on dark backgrounds
                    (7.31:1 AAA)
                  </li>
                  <li>
                    Use Graphite Wash for elevated cards on Obsidian backgrounds
                  </li>
                </ul>
              </div>
              <div className="dont-box">
                <h4>Don&apos;t</h4>
                <ul style={{ padding: 0 }}>
                  <li>
                    Use Burnished Copper (#C4956A) as text on Bone or Signal
                    White - fails WCAG at 2.19:1
                  </li>
                  <li>
                    Use Warm Steel (#8A8578) as readable text on light
                    backgrounds - fails at 3.02:1
                  </li>
                  <li>Use Copper as a background or large surface fill</li>
                  <li>
                    Use pure white (#FFFFFF) - always use Signal White or Bone
                  </li>
                  <li>
                    Use Obsidian on Graphite Wash - insufficient contrast
                    (1.37:1)
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 03. TYPOGRAPHY */}
          <section id="type">
            <span className="sec-num">03</span>
            <h2 className="sec-title">Typography System</h2>
            <p className="sec-desc">
              A four-tier type system that carries editorial authority at
              headline and holds up in dense product UI across 8+ hours of daily
              use.
            </p>

            <div className="type-card">
              <div className="label">Tier 1 - Display &amp; Headlines</div>
              <div
                className="sample"
                style={{
                  fontFamily: "var(--brand-serif)",
                  fontWeight: 500,
                  fontSize: "clamp(32px,4vw,48px)",
                  lineHeight: 1.08,
                }}
              >
                The Relationship System of Record
              </div>
              <div className="notes">
                <strong>Cormorant Garamond 500-600</strong> - High-contrast
                editorial serif with archival gravitas. Use for hero headlines,
                section titles, and brand moments. At display sizes, the
                hairline strokes create visual tension that demands attention.
                Never use below 18px.
                <br />
                <br />
                <strong>Production upgrade:</strong> Swap to Canela, Tiempos, or
                Freight Text for licensed premium alternative.
              </div>
            </div>

            <div className="type-card">
              <div className="label">Tier 2 - Body &amp; Long-form</div>
              <div
                className="sample"
                style={{
                  fontFamily: "var(--brand-sans)",
                  fontWeight: 400,
                  fontSize: "16px",
                  lineHeight: 1.65,
                  maxWidth: "60ch",
                }}
              >
                Scrybe is the authoritative source for everything your
                organization knows about client relationships. Unlike CRMs or
                transcription tools, a Relationship System of Record connects
                context, conversations, and outcomes across time.
              </div>
              <div className="notes">
                <strong>Outfit 400-500</strong> - Modern geometric with warmth.
                The subtle rounding in Outfit&apos;s letterforms bridges
                institutional authority and human approachability. Use for
                paragraphs, descriptions, and marketing copy. Set at 15-17px
                with 1.6-1.7 line-height.
              </div>
            </div>

            <div className="type-card">
              <div className="label">Tier 3 - UI, Labels &amp; Navigation</div>
              <div
                className="sample"
                style={{
                  fontFamily: "var(--brand-sans)",
                  fontWeight: 600,
                  fontSize: "13px",
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                }}
              >
                Audit Log - Signed Export - Redaction - Retention - Compliance
                Trail - Context - Memory
              </div>
              <div className="notes">
                <strong>Outfit 600</strong> - Strong caps for interface
                surfaces. Use for navigation, labels, tags, badges, and filter
                controls. Set at 11-13px with .03-.06em letter-spacing. Always
                uppercase for labels.
              </div>
            </div>

            <div className="type-card">
              <div className="label">Tier 4 - Code, Data &amp; Compliance</div>
              <div
                className="sample"
                style={{
                  fontFamily: "var(--brand-mono)",
                  fontWeight: 400,
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                AES-256 - encrypted_at_rest: true - hipaa_compliant: true -
                soc2_status: in_progress
                <br />
                retention_policy: {"{"} days: 365, auto_delete: false,
                audit_log: enabled {"}"}
              </div>
              <div className="notes">
                <strong>IBM Plex Mono 400</strong> - Institutional monospace for
                technical credibility. Use for audit trails, timestamps,
                compliance badges, code snippets, and data surfaces. The
                humanist design of Plex Mono avoids the coldness of
                developer-focused monospace fonts.
              </div>
            </div>

            <h3 style={{ marginTop: "28px" }}>Type Scale</h3>
            <div className="card" style={{ marginTop: "12px" }}>
              <div className="card-pad">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Element</th>
                      <th>Font</th>
                      <th>Weight</th>
                      <th>Size</th>
                      <th>Line Height</th>
                      <th>Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Hero Headline</td>
                      <td>Cormorant Garamond</td>
                      <td>600</td>
                      <td>48-64px</td>
                      <td>1.05</td>
                      <td>-0.01em</td>
                    </tr>
                    <tr>
                      <td>Section Title</td>
                      <td>Cormorant Garamond</td>
                      <td>500</td>
                      <td>28-40px</td>
                      <td>1.1</td>
                      <td>0</td>
                    </tr>
                    <tr>
                      <td>Card Title</td>
                      <td>Cormorant Garamond</td>
                      <td>500</td>
                      <td>20-24px</td>
                      <td>1.15</td>
                      <td>0</td>
                    </tr>
                    <tr>
                      <td>Body</td>
                      <td>Outfit</td>
                      <td>400</td>
                      <td>15-17px</td>
                      <td>1.65</td>
                      <td>0</td>
                    </tr>
                    <tr>
                      <td>Small Body</td>
                      <td>Outfit</td>
                      <td>400</td>
                      <td>13-14px</td>
                      <td>1.55</td>
                      <td>0</td>
                    </tr>
                    <tr>
                      <td>UI Label</td>
                      <td>Outfit</td>
                      <td>600</td>
                      <td>11-13px</td>
                      <td>1.2</td>
                      <td>0.04em</td>
                    </tr>
                    <tr>
                      <td>Mono / Data</td>
                      <td>IBM Plex Mono</td>
                      <td>400</td>
                      <td>12-13px</td>
                      <td>1.5</td>
                      <td>0</td>
                    </tr>
                    <tr>
                      <td>Caption</td>
                      <td>IBM Plex Mono</td>
                      <td>400</td>
                      <td>11px</td>
                      <td>1.4</td>
                      <td>0.02em</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 04. LOGO & CONVERGENCE MARK */}
          <section id="mark">
            <span className="sec-num">04</span>
            <h2 className="sec-title">Logo &amp; Convergence Mark</h2>
            <p className="sec-desc">
              Two distinct elements - past context and present moment - that
              converge at a focal point. The geometry must be proprietary and
              recognizable at every scale.
            </p>

            <h3>Mark Variants</h3>
            <div className="g4" style={{ margin: "16px 0 24px" }}>
              <div className="mark-cell" style={{ background: "var(--obsidian)" }}>
                <svg width="56" height="56" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="var(--bone)"
                    strokeOpacity=".8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className="ml"
                  style={{ color: "rgba(248,246,242,.45)" }}
                >
                  On Obsidian
                </div>
              </div>
              <div className="mark-cell" style={{ background: "var(--bone)" }}>
                <svg width="56" height="56" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="var(--obsidian)"
                    strokeOpacity=".45"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="ml" style={{ color: "#6B6659" }}>
                  On Bone
                </div>
              </div>
              <div className="mark-cell" style={{ background: "var(--copper)" }}>
                <svg width="56" height="56" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="rgba(255,255,255,.75)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="rgba(255,255,255,.4)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="ml" style={{ color: "rgba(255,255,255,.45)" }}>
                  On Copper
                </div>
              </div>
              <div className="mark-cell" style={{ background: "#1a1a1a" }}>
                <svg width="22" height="22" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="var(--bone)"
                    strokeOpacity=".8"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="ml" style={{ color: "rgba(248,246,242,.4)" }}>
                  Favicon 16px
                </div>
              </div>
            </div>

            <h3>Wordmark Lockups</h3>
            <div className="g2" style={{ margin: "16px 0 24px" }}>
              <div
                className="dark-spec"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "28px",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="var(--bone)"
                    strokeOpacity=".8"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "26px",
                    fontWeight: 500,
                    letterSpacing: ".03em",
                    color: "var(--white)",
                  }}
                >
                  scrybe
                </span>
              </div>
              <div
                className="light-spec"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "28px",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 60 60">
                  <path
                    d="M12 42 C22 22,28 14,30 14 S38 22,48 42"
                    fill="none"
                    stroke="var(--obsidian)"
                    strokeOpacity=".45"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 42 C23 25,28 18,30 18 S37 25,45 42"
                    fill="none"
                    stroke="var(--copper)"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "26px",
                    fontWeight: 500,
                    letterSpacing: ".03em",
                    color: "var(--obsidian)",
                  }}
                >
                  scrybe
                </span>
              </div>
            </div>

            <h3>Clear Space &amp; Minimum Size</h3>
            <div className="g2" style={{ marginTop: "12px" }}>
              <div className="rule">
                <strong>Clear space:</strong> Minimum padding around the mark
                equal to the height of the convergence point (the apex where
                lines meet). No other elements within this zone.
              </div>
              <div className="rule">
                <strong>Minimum size:</strong> Mark only: 16x16px (favicon).
                Full lockup: 120px wide. Below these sizes, use the mark only -
                never the wordmark.
              </div>
            </div>

            <div className="g2" style={{ marginTop: "16px" }}>
              <div className="do-box">
                <h4>Mark Usage - Do</h4>
                <ul style={{ padding: 0 }}>
                  <li>
                    Use the mark at approved sizes on approved backgrounds
                  </li>
                  <li>Maintain clear space proportions</li>
                  <li>
                    Use the single-color version when color printing isn&apos;t
                    available
                  </li>
                  <li>Place on Obsidian, Bone, or Copper backgrounds only</li>
                </ul>
              </div>
              <div className="dont-box">
                <h4>Mark Usage - Don&apos;t</h4>
                <ul style={{ padding: 0 }}>
                  <li>Rotate, skew, or distort the mark</li>
                  <li>Change the stroke weights or proportions</li>
                  <li>Place on busy photographic backgrounds</li>
                  <li>Recolor beyond the approved palette</li>
                  <li>Add drop shadows, gradients, or effects</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 05. BRAND DEVICE */}
          <section id="device">
            <span className="sec-num">05</span>
            <h2 className="sec-title">Brand Device - Memory Threads</h2>
            <p className="sec-desc">
              A repeatable visual pattern derived from the Convergence Mark - a
              network of flowing lines that suggests connection, memory, and
              continuity. This is how the brand looks when you can&apos;t use
              the logo.
            </p>

            <div className="g2" style={{ marginBottom: "24px" }}>
              <div
                className="dark-spec"
                style={{
                  position: "relative",
                  minHeight: "200px",
                  overflow: "hidden",
                }}
              >
                <svg
                  viewBox="0 0 500 200"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.5,
                  }}
                >
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="1" y2=".3">
                      <stop offset="0" stopColor="#C4956A" stopOpacity="0" />
                      <stop offset=".5" stopColor="#C4956A" stopOpacity=".7" />
                      <stop offset="1" stopColor="#EDE8DF" stopOpacity=".1" />
                    </linearGradient>
                  </defs>
                  <g fill="none" stroke="url(#tg)" strokeWidth="1.5">
                    <path
                      d="M-10,160 C80,100 150,80 250,80 C370,80 400,40 510,20"
                      strokeDasharray="300"
                      style={{ animation: "threadAnim 4s ease infinite" }}
                    />
                    <path
                      d="M-10,140 C100,90 170,100 270,100 C370,100 420,60 510,50"
                      strokeDasharray="300"
                      style={{ animation: "threadAnim 4.5s ease infinite" }}
                    />
                    <path
                      d="M-10,120 C80,70 170,60 270,60 C390,60 420,20 510,0"
                      strokeDasharray="300"
                      style={{ animation: "threadAnim 5s ease infinite" }}
                    />
                    <path
                      d="M-10,180 C100,130 180,130 280,130 C390,130 430,90 510,70"
                      strokeDasharray="300"
                      style={{ animation: "threadAnim 5.5s ease infinite" }}
                    />
                  </g>
                </svg>
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div className="label" style={{ color: "var(--copper)" }}>
                    On Dark Surfaces
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "rgba(248,246,242,.55)",
                      marginTop: "8px",
                    }}
                  >
                    Hero backgrounds, slide decks, website headers, product UI
                    transitions.
                  </p>
                </div>
              </div>
              <div
                className="light-spec"
                style={{
                  position: "relative",
                  minHeight: "200px",
                  overflow: "hidden",
                }}
              >
                <svg
                  viewBox="0 0 500 200"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.3,
                  }}
                >
                  <defs>
                    <linearGradient id="tgl" x1="0" y1="0" x2="1" y2=".3">
                      <stop offset="0" stopColor="#C4956A" stopOpacity="0" />
                      <stop offset=".5" stopColor="#C4956A" stopOpacity=".8" />
                      <stop offset="1" stopColor="#0C0C0E" stopOpacity=".1" />
                    </linearGradient>
                  </defs>
                  <g fill="none" stroke="url(#tgl)" strokeWidth="1.5">
                    <path d="M-10,160 C80,100 150,80 250,80 C370,80 400,40 510,20" />
                    <path d="M-10,140 C100,90 170,100 270,100 C370,100 420,60 510,50" />
                    <path d="M-10,120 C80,70 170,60 270,60 C390,60 420,20 510,0" />
                    <path d="M-10,180 C100,130 180,130 280,130 C390,130 430,90 510,70" />
                  </g>
                </svg>
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div className="label" style={{ color: "var(--copper-text)" }}>
                    On Light Surfaces
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6B6659",
                      marginTop: "8px",
                    }}
                  >
                    One-pagers, printed materials, email headers, light-mode
                    marketing.
                  </p>
                </div>
              </div>
            </div>

            <div className="rule">
              <strong>Usage principle:</strong> Memory Threads should always
              flow from left to right, converging toward a focal point. They
              represent &quot;context gathering&quot; - past conversations and
              data coming together into a unified moment of clarity.
            </div>
          </section>

          {/* 06. VOICE & TONE */}
          <section id="voice">
            <span className="sec-num">06</span>
            <h2 className="sec-title">Voice &amp; Tone</h2>
            <p className="sec-desc">
              Scrybe speaks like an institution that has earned trust through
              evidence, not through volume. Quiet authority. Precise claims.
              Human warmth underneath.
            </p>

            <h3>Brand Attributes</h3>
            <div className="g4" style={{ margin: "16px 0 24px" }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #eeebe4",
                  background: "#faf9f5",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "var(--copper-text)",
                    marginBottom: "4px",
                  }}
                >
                  Calm
                </div>
                <div style={{ fontSize: "12px", color: "#6B6659" }}>
                  Never raises its voice
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #eeebe4",
                  background: "#faf9f5",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "var(--copper-text)",
                    marginBottom: "4px",
                  }}
                >
                  Precise
                </div>
                <div style={{ fontSize: "12px", color: "#6B6659" }}>
                  Claims backed by specifics
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #eeebe4",
                  background: "#faf9f5",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "var(--copper-text)",
                    marginBottom: "4px",
                  }}
                >
                  Warm
                </div>
                <div style={{ fontSize: "12px", color: "#6B6659" }}>
                  Human under the authority
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #eeebe4",
                  background: "#faf9f5",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--brand-serif)",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: "var(--copper-text)",
                    marginBottom: "4px",
                  }}
                >
                  Permanent
                </div>
                <div style={{ fontSize: "12px", color: "#6B6659" }}>
                  Built to last decades
                </div>
              </div>
            </div>

            <h3>Trust Language Rules</h3>
            <div className="card" style={{ margin: "12px 0 24px" }}>
              <div className="card-pad">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Don&apos;t Say</th>
                      <th>Do Say</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>&quot;Bank-level security&quot;</td>
                      <td>&quot;HIPAA-compliant infrastructure&quot;</td>
                      <td>Specific &gt; vague</td>
                    </tr>
                    <tr>
                      <td>&quot;Military-grade encryption&quot;</td>
                      <td>
                        &quot;Encrypted at rest and in transit (AES-256)&quot;
                      </td>
                      <td>Verifiable &gt; impressive</td>
                    </tr>
                    <tr>
                      <td>&quot;100% secure&quot;</td>
                      <td>
                        &quot;You control retention, access, and deletion&quot;
                      </td>
                      <td>Control &gt; impossible claims</td>
                    </tr>
                    <tr>
                      <td>
                        &quot;AI magic&quot; / &quot;Our AI understands...&quot;
                      </td>
                      <td>&quot;Context surfaced automatically&quot;</td>
                      <td>Outcome &gt; mechanism</td>
                    </tr>
                    <tr>
                      <td>&quot;SOC2 certified&quot;</td>
                      <td>
                        &quot;SOC2 Type II certification in progress&quot;
                      </td>
                      <td>Honest status &gt; premature claim</td>
                    </tr>
                    <tr>
                      <td>&quot;Smart&quot; / &quot;Intelligent&quot;</td>
                      <td>
                        &quot;Queryable&quot; / &quot;Searchable&quot; /
                        &quot;Persistent&quot;
                      </td>
                      <td>Function &gt; adjective</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3>Tone by Context</h3>
            <div className="g2">
              <div>
                <div className="rule">
                  <strong>Marketing site:</strong> Editorial confidence. Lead
                  with outcomes, follow with evidence. Use Cormorant Garamond
                  headlines to set authority, Outfit body to keep it human.
                </div>
                <div className="rule">
                  <strong>Sales deck:</strong> Precise and evidence-forward. Use
                  compliance specifics early. Never oversell - undersell and
                  overdeliver.
                </div>
              </div>
              <div>
                <div className="rule">
                  <strong>Product UI:</strong> Invisible and efficient. Labels
                  are short. Descriptions are clear. The product should feel
                  like a well-organized archive, not a chatbot.
                </div>
                <div className="rule">
                  <strong>Support/docs:</strong> Warm and patient. The most
                  human context. Use &quot;you&quot; liberally. Anticipate
                  confusion. Never condescend.
                </div>
              </div>
            </div>
          </section>

          {/* 07. MOTION */}
          <section id="motion">
            <span className="sec-num">07</span>
            <h2 className="sec-title">Motion Principles</h2>
            <p className="sec-desc">
              How &quot;context appearing&quot; looks visually. Motion patterns
              should be consistent across product and marketing.
            </p>

            <div className="g3" style={{ marginBottom: "24px" }}>
              <div className="card">
                <div className="card-pad" style={{ textAlign: "center" }}>
                  <div
                    className="anim-fade"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "rgba(196,149,106,.15)",
                      border: "1px solid rgba(196,149,106,.3)",
                      margin: "0 auto 14px",
                    }}
                  ></div>
                  <h3 style={{ fontSize: "16px" }}>Emergence</h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6B6659",
                      marginTop: "6px",
                    }}
                  >
                    Context cards and information appear with a gentle fade-in
                    and subtle upward movement. Like memories surfacing.
                  </p>
                  <div className="caption" style={{ marginTop: "10px" }}>
                    300-500ms - ease-out
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-pad" style={{ textAlign: "center" }}>
                  <div
                    className="anim-pulse"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "rgba(196,149,106,.1)",
                      border: "1px solid rgba(196,149,106,.25)",
                      margin: "0 auto 14px",
                    }}
                  ></div>
                  <h3 style={{ fontSize: "16px" }}>Connection</h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6B6659",
                      marginTop: "6px",
                    }}
                  >
                    When showing relationships between conversations or
                    outcomes, use subtle connecting lines. The Convergence Field
                    in motion.
                  </p>
                  <div className="caption" style={{ marginTop: "10px" }}>
                    400-600ms - ease-in-out
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-pad" style={{ textAlign: "center" }}>
                  <div
                    style={{ width: "100%", height: "48px", marginBottom: "14px" }}
                  >
                    <svg
                      width="100%"
                      height="48"
                      viewBox="0 0 200 48"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M0,38 C40,8 80,22 120,18 S180,8 200,12"
                        fill="none"
                        stroke="var(--copper)"
                        strokeWidth="2"
                        strokeOpacity=".5"
                        strokeDasharray="300"
                        style={{ animation: "threadAnim 3s ease infinite" }}
                      />
                      <path
                        d="M0,34 C50,12 90,28 130,22 S175,12 200,18"
                        fill="none"
                        stroke="var(--copper-light)"
                        strokeWidth="1.5"
                        strokeOpacity=".3"
                        strokeDasharray="300"
                        style={{ animation: "threadAnim 3.5s ease infinite" }}
                      />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: "16px" }}>Thread Draw</h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6B6659",
                      marginTop: "6px",
                    }}
                  >
                    Memory Threads draw on-screen progressively, revealing
                    connections across conversations and time.
                  </p>
                  <div className="caption" style={{ marginTop: "10px" }}>
                    800-1200ms - ease
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-pad">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Context</th>
                      <th>Duration</th>
                      <th>Easing</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Micro-interactions</td>
                      <td>200-400ms</td>
                      <td>ease-out</td>
                      <td>Button states, toggles, hover effects</td>
                    </tr>
                    <tr>
                      <td>Content transitions</td>
                      <td>400-600ms</td>
                      <td>ease-in-out</td>
                      <td>Page changes, card reveals, panel switches</td>
                    </tr>
                    <tr>
                      <td>Brand moments</td>
                      <td>800-1200ms</td>
                      <td>ease</td>
                      <td>Memory Threads, hero animations, logo reveals</td>
                    </tr>
                    <tr>
                      <td>Never</td>
                      <td>-</td>
                      <td>-</td>
                      <td>
                        No bounce, spring, or playful easing. Professional and
                        assured.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 10. VERTICAL MESSAGING */}
          <section id="verticals">
            <span className="sec-num">10</span>
            <h2 className="sec-title">Vertical Message Variants</h2>
            <p className="sec-desc">
              Same product. Same brand system. Different &quot;why it
              matters.&quot; The visual identity stays constant - only the
              language adapts.
            </p>

            <div className="g2" style={{ marginBottom: "16px" }}>
              <div className="vert">
                <div className="vert-label">Case Management (Beachhead)</div>
                <div className="vert-hl">
                  Know every client. Even when staff turns over.
                </div>
                <div className="vert-sub">
                  Institutional memory for case managers. HIPAA-compliant. Built
                  for ongoing relationships, not sales cycles.
                </div>
              </div>
              <div className="vert">
                <div className="vert-label">Legal</div>
                <div className="vert-hl">
                  Every client call. Searchable. Timestamped.
                </div>
                <div className="vert-sub">
                  Defensible records of client communications. Built for law
                  firms that need evidence, not summaries.
                </div>
              </div>
            </div>
            <div className="g2">
              <div className="vert">
                <div className="vert-label">Healthcare</div>
                <div className="vert-hl">
                  Patient history that follows the conversation.
                </div>
                <div className="vert-sub">
                  HIPAA-compliant memory for care coordination. Context during
                  calls, continuity across providers.
                </div>
              </div>
              <div className="vert">
                <div className="vert-label">Insurance</div>
                <div className="vert-hl">
                  Audit-ready records. No scrambling.
                </div>
                <div className="vert-sub">
                  Every policyholder interaction documented automatically. Built
                  for compliance, not just convenience.
                </div>
              </div>
            </div>
          </section>

          {/* 12. TRUST SYSTEM */}
          <section id="trust">
            <span className="sec-num">12</span>
            <h2 className="sec-title">Trust System - Visual Patterns</h2>
            <p className="sec-desc">
              Enterprise trust is earned through specifics. These visual
              patterns show how trust claims appear consistently across the
              brand.
            </p>

            <h3>Trust Badge System</h3>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                margin: "12px 0 20px",
              }}
            >
              <span className="badge badge-copper">HIPAA-Compliant</span>
              <span className="badge badge-copper">Encrypted (AES-256)</span>
              <span className="badge badge-copper">
                No AI Training on Your Data
              </span>
              <span className="badge badge-copper">Full Audit Trail</span>
              <span className="badge badge-copper">Role-Based Access</span>
              <span
                className="badge"
                style={{
                  background: "rgba(196,149,106,.08)",
                  color: "var(--muted-brand)",
                  border: "1px dashed var(--steel)",
                }}
              >
                SOC2 Type II In Progress
              </span>
            </div>

            <div className="rule">
              <strong>Active claims</strong> use the solid copper badge.{" "}
              <strong>In-progress claims</strong> use the dashed-border variant
              with muted text. Never display an in-progress item with the same
              visual weight as an active claim.
            </div>

            <h3 style={{ marginTop: "24px" }}>Claim Status Reference</h3>
            <div className="card" style={{ marginTop: "12px" }}>
              <div className="card-pad">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Status</th>
                      <th>Badge Style</th>
                      <th>Language</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>HIPAA Compliant</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>&quot;HIPAA-compliant infrastructure&quot;</td>
                    </tr>
                    <tr>
                      <td>End-to-end Encryption</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>
                        &quot;Encrypted at rest and in transit (AES-256)&quot;
                      </td>
                    </tr>
                    <tr>
                      <td>No AI Training</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>
                        &quot;Your data is never used to train AI models&quot;
                      </td>
                    </tr>
                    <tr>
                      <td>Audit Logs</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>&quot;Full audit trail&quot;</td>
                    </tr>
                    <tr>
                      <td>Role-based Access</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>&quot;Granular permissions&quot;</td>
                    </tr>
                    <tr>
                      <td>Data Retention Controls</td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td>Solid copper</td>
                      <td>&quot;Set your own retention policies&quot;</td>
                    </tr>
                    <tr>
                      <td>SOC2 Type II</td>
                      <td>
                        <span className="badge badge-gray">In Progress</span>
                      </td>
                      <td>Dashed muted</td>
                      <td>
                        &quot;SOC2 Type II certification in progress&quot;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 13. PRODUCT GLOSSARY */}
          <section id="glossary">
            <span className="sec-num">13</span>
            <h2 className="sec-title">Product Glossary</h2>
            <p className="sec-desc">
              Use these definitions consistently across all materials. Precision
              reduces enterprise confusion and increases confidence.
            </p>

            <div className="card">
              <div
                className="card-pad"
                style={{ display: "grid", gap: "16px" }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    Relationship System of Record
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    The authoritative source for everything your organization
                    knows about client relationships. Unlike CRMs (contact
                    databases) or transcription tools (conversation archives), a
                    Relationship System of Record connects context,
                    conversations, and outcomes across time.
                  </p>
                </div>
                <div
                  style={{ borderTop: "1px solid #eeebe4", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    Relationship Memory
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    Everything Scrybe stores and recalls: conversation history,
                    extracted facts, commitments made, outcomes tracked,
                    patterns detected. Memory is queryable, persistent (survives
                    staff turnover), and institutional (shared across authorized
                    team members).
                  </p>
                </div>
                <div
                  style={{ borderTop: "1px solid #eeebe4", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    Context Surfacing
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    Automatically presenting relevant information during a call
                    - not after. When a client calls, Scrybe shows past
                    conversation summaries, key facts, open commitments, and
                    relevant patterns in real-time without manual lookup.
                  </p>
                </div>
                <div
                  style={{ borderTop: "1px solid #eeebe4", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    Outcome Tracking
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    Automatically monitoring what happens after conversations.
                    Were commitments kept? Did follow-ups occur? How did
                    situations resolve? Scrybe detects patterns without manual
                    CRM updates.
                  </p>
                </div>
                <div
                  style={{ borderTop: "1px solid #eeebe4", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    Continuity
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    Every conversation builds on the last. No starting from
                    scratch. New team members inherit full client history.
                    Departing employees don&apos;t take knowledge with them.
                    Relationships that compound over time.
                  </p>
                </div>
                <div
                  style={{ borderTop: "1px solid #eeebe4", paddingTop: "16px" }}
                >
                  <div
                    style={{
                      fontFamily: "var(--brand-serif)",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#1a1a1a",
                    }}
                  >
                    VoIP Integration
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      lineHeight: 1.6,
                      marginTop: "4px",
                    }}
                  >
                    Scrybe connects to phone systems (Voice over IP) - not just
                    video meetings. Most AI meeting tools only work with
                    Zoom/Teams. Scrybe captures conversations where most client
                    relationships actually live: the phone.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 14. DELIVERABLES */}
          <section id="deliverables">
            <span className="sec-num">14</span>
            <h2 className="sec-title">Required Deliverables</h2>
            <p className="sec-desc">
              Assets needed for full brand deployment across marketing, product,
              and sales touchpoints.
            </p>

            <div className="card">
              <div className="card-pad">
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Description</th>
                      <th>Formats</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Logo Package</td>
                      <td>
                        Primary lockup, stacked lockup, mark only, wordmark
                        only. All color variations.
                      </td>
                      <td>SVG, PNG, PDF, AI</td>
                    </tr>
                    <tr>
                      <td>Brand Device Assets</td>
                      <td>
                        Memory Threads / Convergence Field pattern in multiple
                        scales. Background textures. Animated versions.
                      </td>
                      <td>SVG, MP4, Lottie</td>
                    </tr>
                    <tr>
                      <td>Brand Guidelines</td>
                      <td>This document in final production form.</td>
                      <td>PDF, Web</td>
                    </tr>
                    <tr>
                      <td>Application Mockups</td>
                      <td>
                        Homepage hero, one-pager, sales deck opening, business
                        card, app login screen.
                      </td>
                      <td>Figma, PDF</td>
                    </tr>
                    <tr>
                      <td>Icon Set (Starter)</td>
                      <td>
                        20-30 core icons in brand style for marketing and
                        product use.
                      </td>
                      <td>SVG, Icon Font</td>
                    </tr>
                    <tr>
                      <td>Social Templates</td>
                      <td>
                        LinkedIn, Twitter/X header and post templates in brand
                        system.
                      </td>
                      <td>Figma, PNG</td>
                    </tr>
                    <tr>
                      <td>Email Signature</td>
                      <td>
                        HTML signature with Convergence Mark and brand
                        typography.
                      </td>
                      <td>HTML</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div className="brand-footer">
          <div className="brand-footer-inner">
            <div>
              <div className="logo">
                scrybe<span>.</span>
              </div>
              <div style={{ marginTop: "6px" }}>
                The Relationship System of Record
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>Obsidian Signal - Brand Guide v1.0</div>
              <div style={{ marginTop: "4px" }}>
                Prepared by Scrybe / Phoenixing LLC - February 2026
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
