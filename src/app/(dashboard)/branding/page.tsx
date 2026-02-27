"use client";

import { useEffect, useRef } from "react";

export default function BrandingPage() {
  const voiceMainRef = useRef<HTMLCanvasElement>(null);
  const voiceIdleRef = useRef<HTMLCanvasElement>(null);
  const voiceMiniRef = useRef<HTMLCanvasElement>(null);

  // Rorschach blob animation
  useEffect(() => {
    class Point {
      parent: RorschachBlob;
      azimuth: number;
      _components: { x: number; y: number };
      _acceleration = 0;
      _speed = 0;
      _radialEffect = 0;
      elasticity = 0.001;
      friction = 0.0085;

      constructor(azimuth: number, parent: RorschachBlob) {
        this.parent = parent;
        this.azimuth = Math.PI - azimuth;
        this._components = { x: Math.cos(this.azimuth), y: Math.sin(this.azimuth) };
        this._acceleration = -0.3 + Math.random() * 0.6;
        this._speed = 0.002 + Math.random() * 0.002;
      }

      solveWith(leftPoint: Point, rightPoint: Point) {
        this._acceleration = (-0.3 * this._radialEffect + (leftPoint._radialEffect - this._radialEffect) + (rightPoint._radialEffect - this._radialEffect)) * this.elasticity - this._speed * this.friction;
      }

      get position() {
        return {
          x: this.parent.center.x + this._components.x * (this.parent.radius + this._radialEffect),
          y: this.parent.center.y + this._components.y * (this.parent.radius + this._radialEffect),
        };
      }
    }

    class RorschachBlob {
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      color: string;
      numPoints: number;
      radius: number;
      intensity: number;
      mirror: boolean;
      mini: boolean;
      maxRadialEffect: number;
      center: { x: number; y: number };
      points: Point[] = [];
      divisional: number;
      targetIntensity: number;
      currentIntensity: number;
      _destroyed = false;

      constructor(canvas: HTMLCanvasElement, opts: {
        color?: string;
        numPoints?: number;
        radius?: number;
        intensity?: number;
        mirror?: boolean;
        mini?: boolean;
        maxRadialEffect?: number;
      } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.color = opts.color || '#1B2A4A';
        this.numPoints = opts.numPoints || 8;
        this.radius = opts.radius || 50;
        this.intensity = opts.intensity || 0.6;
        this.mirror = opts.mirror !== false;
        this.mini = opts.mini || false;
        this.maxRadialEffect = opts.maxRadialEffect || 20;
        this.center = { x: canvas.width / 2, y: canvas.height / 2 };
        if (this.mirror && !this.mini) {
          this.center.x = canvas.width / 2 + this.radius * 0.15;
        }
        this.divisional = (Math.PI * 2) / this.numPoints;
        for (let i = 0; i < this.numPoints; i++) {
          this.points.push(new Point(this.divisional * (i + 1), this));
        }
        this.targetIntensity = this.intensity;
        this.currentIntensity = this.intensity;
        this._simulateVoice();
        this._animate();
      }

      _simulateVoice() {
        const pulse = () => {
          if (this._destroyed) return;
          const speaking = Math.random() > 0.3;
          if (speaking) {
            this.targetIntensity = this.mini ? 0.3 + Math.random() * 0.5 : 0.4 + Math.random() * 0.6;
          } else {
            this.targetIntensity = this.mini ? 0.1 : 0.08 + Math.random() * 0.15;
          }
          setTimeout(pulse, 150 + Math.random() * 500);
        };
        pulse();
      }

      _drawHalf(ctx: CanvasRenderingContext2D, points: Point[], numPoints: number, flipX: boolean) {
        const center = this.center;
        points[0].solveWith(points[numPoints - 1], points[1]);
        let p0 = points[numPoints - 1].position;
        let p1 = points[0].position;
        if (flipX) {
          p0 = { x: 2 * center.x - p0.x, y: p0.y };
          p1 = { x: 2 * center.x - p1.x, y: p1.y };
        }
        ctx.beginPath();
        ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        for (let i = 1; i < numPoints; i++) {
          points[i].solveWith(points[i - 1], points[i + 1] || points[0]);
          let p2 = points[i].position;
          if (flipX) {
            p2 = { x: 2 * center.x - p2.x, y: p2.y };
          }
          const xc = (p1.x + p2.x) / 2;
          const yc = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
          p1 = p2;
        }
        let pFinal = points[0].position;
        if (flipX) {
          pFinal = { x: 2 * center.x - pFinal.x, y: pFinal.y };
        }
        const xc = (p1.x + pFinal.x) / 2;
        const yc = (p1.y + pFinal.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
        ctx.closePath();
        ctx.fill();
      }

      _animate() {
        if (this._destroyed) return;
        const ctx = this.ctx;
        const canvas = this.canvas;
        this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 0.06;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < this.numPoints; i++) {
          const point = this.points[i];
          point.elasticity = 0.001 + this.currentIntensity * 0.003;
          point.friction = 0.0085 + (1 - this.currentIntensity) * 0.005;
          const drive = (Math.sin(Date.now() * 0.003 * (i + 1) * 0.3) * this.currentIntensity * this.maxRadialEffect);
          point._radialEffect += (drive - point._radialEffect) * 0.03;
          point._speed += point._acceleration;
          point._radialEffect += point._speed;
        }
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.65 + this.currentIntensity * 0.20;
        this._drawHalf(ctx, this.points, this.numPoints, false);
        if (this.mirror) {
          ctx.globalAlpha = 0.55 + this.currentIntensity * 0.20;
          this._drawHalf(ctx, this.points, this.numPoints, true);
        }
        if (!this.mini) {
          ctx.globalAlpha = 0.08 + this.currentIntensity * 0.06;
          ctx.save();
          ctx.translate(this.center.x, this.center.y);
          ctx.scale(1.15, 1.15);
          ctx.translate(-this.center.x, -this.center.y);
          this._drawHalf(ctx, this.points, this.numPoints, false);
          if (this.mirror) {
            this._drawHalf(ctx, this.points, this.numPoints, true);
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(() => this._animate());
      }

      destroy() { this._destroyed = true; }
    }

    class IdleBlob extends RorschachBlob {
      _simulateVoice() {
        const pulse = () => {
          if (this._destroyed) return;
          this.targetIntensity = 0.05 + Math.random() * 0.12;
          setTimeout(pulse, 600 + Math.random() * 1400);
        };
        pulse();
      }
    }

    const blobs: RorschachBlob[] = [];
    const color = '#1B2A4A';

    if (voiceMainRef.current) {
      blobs.push(new RorschachBlob(voiceMainRef.current, {
        numPoints: 10, radius: 55, color, intensity: 0.65, maxRadialEffect: 28,
      }));
    }
    if (voiceIdleRef.current) {
      blobs.push(new IdleBlob(voiceIdleRef.current, {
        numPoints: 8, radius: 40, color, intensity: 0.1, maxRadialEffect: 12,
      }));
    }
    if (voiceMiniRef.current) {
      blobs.push(new RorschachBlob(voiceMiniRef.current, {
        numPoints: 6, radius: 10, color, intensity: 0.4, maxRadialEffect: 6, mini: true,
      }));
    }

    return () => { blobs.forEach(b => b.destroy()); };
  }, []);

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
          --font: "Soehne", var(--font-inter), system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          --font-serif: "Tiempos Text", Georgia, "Times New Roman", serif;
          --font-display: "Soehne Breit", "Soehne", var(--font-inter), sans-serif;
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
          font-weight: 300;
          line-height: 1.6;
          min-height: 100vh;
        }

        /* Headings use Tiempos (serif) */
        .brand-page h1,
        .brand-page h2,
        .brand-page h3 {
          font-family: var(--font-serif);
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

        /* Recording button */
        .brand-page .btn-record {
          background: var(--ink-blue);
          color: #fff;
          padding: 14px 28px;
          border-radius: var(--radius-lg);
          font-size: 15px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          border: none;
          cursor: pointer;
          transition: all var(--fast) var(--ease-out);
        }
        .brand-page .btn-record:hover {
          background: var(--ink-blue-mid);
          box-shadow: 0 4px 16px rgba(27,42,74,0.30);
          transform: translateY(-2px);
        }
        .brand-page .btn-record-stop {
          background: var(--ink-red);
        }
        .brand-page .btn-record-stop:hover {
          background: #a03d3d;
          box-shadow: 0 4px 16px rgba(179,71,71,0.30);
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

        /* Validation states */
        .brand-page input.error {
          border-color: var(--ink-red);
          box-shadow: 0 0 0 3px var(--ink-red-wash);
        }
        .brand-page input.success {
          border-color: var(--ink-green);
          box-shadow: 0 0 0 3px var(--ink-green-wash);
        }

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
        .brand-page .t-caption { font-size: 13px; line-height: 1.5; font-weight: 400; color: var(--ink-muted); }
        .brand-page .t-label { font-size: 11px; line-height: 1.25; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
        .brand-page .t-mono { font-size: 12px; font-family: var(--mono); color: var(--ink-soft); }

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

        /* Tabs */
        .brand-page .tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--paper-dim);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-light);
        }
        .brand-page .tab {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: var(--ink-muted);
          border-radius: 6px;
          cursor: pointer;
          transition: all var(--fast) var(--ease-out);
          border: none;
          background: transparent;
        }
        .brand-page .tab:hover { color: var(--ink); }
        .brand-page .tab.active {
          background: var(--paper);
          color: var(--ink);
          box-shadow: var(--shadow-sm);
        }

        /* Toggle */
        .brand-page .toggle {
          position: relative;
          width: 44px;
          height: 24px;
          background: var(--border);
          border-radius: 999px;
          cursor: pointer;
          transition: all var(--fast) var(--ease-out);
        }
        .brand-page .toggle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: var(--paper);
          border-radius: 50%;
          box-shadow: var(--shadow-sm);
          transition: all var(--fast) var(--ease-out);
        }
        .brand-page .toggle.active {
          background: var(--ink-blue);
        }
        .brand-page .toggle.active::after {
          left: 22px;
        }

        /* Toast notifications */
        .brand-page .toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: var(--radius-md);
          background: var(--paper);
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-md);
          max-width: 360px;
        }
        .brand-page .toast-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
        }
        .brand-page .toast-content { flex: 1; }
        .brand-page .toast-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
        .brand-page .toast-message { font-size: 12px; color: var(--ink-muted); }
        .brand-page .toast.success .toast-icon { background: var(--ink-green-wash); color: var(--ink-green); }
        .brand-page .toast.error .toast-icon { background: var(--ink-red-wash); color: var(--ink-red); }
        .brand-page .toast.warning .toast-icon { background: var(--ink-amber-wash); color: var(--ink-amber); }
        .brand-page .toast.info .toast-icon { background: var(--ink-blue-wash); color: var(--ink-blue); }

        /* Token table */
        .brand-page .token-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .brand-page .token-table th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--ink-muted);
          background: var(--paper-dim);
          border-bottom: 1px solid var(--border-light);
        }
        .brand-page .token-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-light);
        }
        .brand-page .token-table code {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--ink-blue);
        }

        /* Voice blob container */
        .brand-page .voice-blob-container {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--paper-dim);
          border-radius: var(--radius-lg);
          padding: 32px;
        }

        /* Marketing patterns */
        .brand-page .stipple-pattern {
          background-image: radial-gradient(circle, var(--ink) 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.08;
        }
        .brand-page .cross-hatch {
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            var(--ink-blue) 4px,
            var(--ink-blue) 5px
          );
          opacity: 0.06;
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
              <a href="#voice">Voice Viz</a>
              <a href="#notifications">Notifications</a>
              <a href="#marketing">Marketing</a>
              <a href="#logo">Logo</a>
              <a href="#tokens">Tokens</a>
              <a href="#loading">Loading</a>
            </nav>
          </header>

          {/* 01 — Brand Strategy */}
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
                <p className="t-body" style={{ marginTop: "16px" }}>Like a university registrar or trusted hospital administrator. Confidence without aggression. Calm professionalism.</p>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <h3>Voice & Tone</h3>
              <div className="grid2" style={{ marginTop: "16px" }}>
                <div>
                  <div className="label">We Sound Like</div>
                  <ul className="list">
                    <li>A trusted advisor in a quiet office</li>
                    <li>An experienced colleague who gets it</li>
                    <li>Someone who respects your time</li>
                    <li>Clear, direct, never condescending</li>
                  </ul>
                </div>
                <div>
                  <div className="label">We Never Sound Like</div>
                  <ul className="list">
                    <li>A startup with something to prove</li>
                    <li>A robot reciting documentation</li>
                    <li>An overeager salesperson</li>
                    <li>Someone who uses jargon to impress</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 02 — Color System */}
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

            <div className="card">
              <div className="label">Extended Neutrals</div>
              <div className="swatches" style={{ marginTop: "12px" }}>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#F5F4F0" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Paper Warm</div><div className="swatch-hex">#F5F4F0</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#EEEDEA" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Paper Dim</div><div className="swatch-hex">#EEEDEA</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#3A3A3A" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Ink Soft</div><div className="swatch-hex">#3A3A3A</div></div>
                </div>
                <div className="swatch">
                  <div className="swatch-color" style={{ background: "#6B6B6B" }}></div>
                  <div className="swatch-info"><div className="swatch-name">Ink Muted</div><div className="swatch-hex">#6B6B6B</div></div>
                </div>
              </div>
            </div>
          </section>

          {/* 03 — Typography */}
          <section id="type">
            <h4>03 — Typography</h4>
            <h2>Tiempos + Soehne — Two Typefaces, Clear Roles</h2>
            <p className="section-note">
              Tiempos Text (serif) for headings and display. Soehne (sans-serif) for body and UI. This pairing creates institutional warmth while maintaining clarity.
            </p>

            <div className="grid2" style={{ marginBottom: "24px" }}>
              <div className="card">
                <div className="label">Tiempos Text — Headlines</div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 400, marginTop: "12px", lineHeight: 1.3 }}>
                  The serif for headings and marketing. Warm, institutional, trustworthy.
                </p>
                <p className="t-caption" style={{ marginTop: "12px" }}>Weights: Regular (400), Semibold (600)</p>
              </div>
              <div className="card">
                <div className="label">Soehne — Body & UI</div>
                <p style={{ fontFamily: "var(--font)", fontSize: "16px", fontWeight: 300, marginTop: "12px", lineHeight: 1.6 }}>
                  The sans-serif for body text and interface elements. Clean, modern, readable.
                </p>
                <p className="t-caption" style={{ marginTop: "12px" }}>Weights: Light (300), Medium (500)</p>
              </div>
            </div>

            <div className="card">
              <div className="typeRow">
                <div className="typeName">Display</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "48px", lineHeight: 1.1, fontWeight: 400 }}>Headline</div>
                <div className="typeSpec">Tiempos 48 / 400</div>
              </div>
              <div className="typeRow">
                <div className="typeName">H1</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "32px", lineHeight: 1.2, fontWeight: 600 }}>Section heading</div>
                <div className="typeSpec">Tiempos 32 / 600</div>
              </div>
              <div className="typeRow">
                <div className="typeName">H2</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", lineHeight: 1.3, fontWeight: 400 }}>Card title / Subsection</div>
                <div className="typeSpec">Tiempos 22 / 400</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Body</div>
                <div className="t-body">Body text reads at 14px with Soehne Light. Comfortable for extended reading in dashboards.</div>
                <div className="typeSpec">Soehne 14 / 300</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Body Medium</div>
                <div style={{ fontFamily: "var(--font)", fontSize: "14px", fontWeight: 500, color: "var(--ink-soft)" }}>Emphasized body text uses Soehne Medium weight.</div>
                <div className="typeSpec">Soehne 14 / 500</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Caption</div>
                <div className="t-caption">Metadata and secondary information</div>
                <div className="typeSpec">Soehne 13 / 300</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Label</div>
                <div className="t-label">SECTION LABEL</div>
                <div className="typeSpec">Soehne 11 / 500</div>
              </div>
              <div className="typeRow">
                <div className="typeName">Mono</div>
                <div className="t-mono">const data = await fetch(url)</div>
                <div className="typeSpec">SF Mono 12 / 400</div>
              </div>
            </div>
          </section>

          {/* 04 — Buttons */}
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
                <div className="label">Recording Controls</div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <button className="btn-record">
                    <canvas ref={voiceMiniRef} width={40} height={40} style={{ width: "20px", height: "20px" }}></canvas>
                    Start Recording
                  </button>
                  <button className="btn-record btn-record-stop">
                    <span style={{ width: "12px", height: "12px", background: "#fff", borderRadius: "2px" }}></span>
                    Stop
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Status System</div>
              <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", marginTop: "8px" }}>
                <span className="status-dot blue">Recording</span>
                <span className="status-dot green">Completed</span>
                <span className="status-dot amber">Review needed</span>
                <span className="status-dot red">Paused</span>
              </div>
            </div>
          </section>

          {/* 05 — Inputs & Forms */}
          <section id="inputs">
            <h4>05 — Inputs & Forms</h4>
            <h2>Writing Surfaces</h2>
            <p className="section-note">
              Inputs should feel like document fields, not web forms. Clean borders, ink-blue focus state, gentle transition.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Text Inputs</div>
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
                <div className="label">Validation States</div>
                <div className="field">
                  <label className="input-label">Valid Field</label>
                  <input className="success" defaultValue="Valid input" />
                </div>
                <div className="field" style={{ marginTop: "16px" }}>
                  <label className="input-label">Error Field</label>
                  <input className="error" defaultValue="Invalid input" />
                  <span style={{ fontSize: "12px", color: "var(--ink-red)" }}>This field is required</span>
                </div>
                <div className="divider" style={{ margin: "24px 0" }}></div>
                <div className="label">Toggle</div>
                <div style={{ display: "flex", gap: "24px", alignItems: "center", marginTop: "8px" }}>
                  <div className="toggle"></div>
                  <div className="toggle active"></div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Tags & Chips</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span className="chip">Default</span>
                <span className="chip blue">Active</span>
                <span className="chip green">Verified</span>
                <span className="chip red">Blocked</span>
                <span className="chip amber">Pending</span>
              </div>
            </div>
          </section>

          {/* 06 — Components */}
          <section id="components">
            <h4>06 — Components</h4>
            <h2>Product Components</h2>
            <p className="section-note">
              The building blocks of the Inkra product. Every component follows the same principles: calm, structured, institutional.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Tabs</div>
                <div className="tabs" style={{ marginTop: "8px" }}>
                  <button className="tab active">Overview</button>
                  <button className="tab">Activity</button>
                  <button className="tab">Files</button>
                  <button className="tab">Settings</button>
                </div>
              </div>
              <div className="card">
                <div className="label">Record Card</div>
                <div style={{ padding: "16px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "var(--paper)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>Client Intake — Maria Santos</div>
                      <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>Today, 2:34 PM · 18 min</div>
                    </div>
                    <span className="chip green">Completed</span>
                  </div>
                  <div className="divider"></div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--ink-muted)" }}>
                    <span>12 fields extracted</span>
                    <span>High confidence</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Data Table Row</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 80px", gap: "16px", padding: "12px 0", borderBottom: "1px solid var(--border-light)", fontSize: "13px", alignItems: "center" }}>
                <div style={{ fontWeight: 500 }}>James Rodriguez</div>
                <div style={{ color: "var(--ink-muted)" }}>Housing Assistance</div>
                <div><span className="chip green" style={{ fontSize: "11px", padding: "2px 8px" }}>Active</span></div>
                <div style={{ color: "var(--ink-muted)" }}>Feb 24</div>
                <div style={{ textAlign: "right" }}><button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "12px" }}>View</button></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 80px", gap: "16px", padding: "12px 0", fontSize: "13px", alignItems: "center" }}>
                <div style={{ fontWeight: 500 }}>Elena Martinez</div>
                <div style={{ color: "var(--ink-muted)" }}>Job Training</div>
                <div><span className="chip amber" style={{ fontSize: "11px", padding: "2px 8px" }}>Review</span></div>
                <div style={{ color: "var(--ink-muted)" }}>Feb 23</div>
                <div style={{ textAlign: "right" }}><button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "12px" }}>View</button></div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
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

          {/* 07 — Voice Visualization */}
          <section id="voice">
            <h4>07 — Voice Visualization</h4>
            <h2>Rorschach Ink Blobs</h2>
            <p className="section-note">
              Live voice activity is visualized as a mirrored, organic ink blob — like a Rorschach test. The shape responds to speech intensity with subtle spring physics. It feels alive without being distracting.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Active — Speaking</div>
                <div className="voice-blob-container">
                  <canvas ref={voiceMainRef} width={280} height={200} style={{ width: "280px", height: "200px" }}></canvas>
                </div>
                <p className="t-caption" style={{ marginTop: "12px", textAlign: "center" }}>High intensity, responsive to speech patterns</p>
              </div>
              <div className="card">
                <div className="label">Idle — Listening</div>
                <div className="voice-blob-container">
                  <canvas ref={voiceIdleRef} width={200} height={160} style={{ width: "200px", height: "160px" }}></canvas>
                </div>
                <p className="t-caption" style={{ marginTop: "12px", textAlign: "center" }}>Low intensity, gentle breathing motion</p>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <h3>Blob Behavior Rules</h3>
              <div className="grid2" style={{ marginTop: "16px" }}>
                <div>
                  <div className="label">Physics</div>
                  <ul className="list">
                    <li>Spring-based point oscillation</li>
                    <li>Smooth intensity interpolation (0.06 factor)</li>
                    <li>Elasticity scales with voice intensity</li>
                    <li>Bilateral symmetry (Rorschach effect)</li>
                  </ul>
                </div>
                <div>
                  <div className="label">States</div>
                  <ul className="list">
                    <li><strong>Speaking:</strong> 0.4–1.0 intensity, responsive</li>
                    <li><strong>Listening:</strong> 0.05–0.15 intensity, gentle</li>
                    <li><strong>Paused:</strong> Static, minimal movement</li>
                    <li>Color: Ink Blue (#1B2A4A) at 65–85% opacity</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 08 — Notifications */}
          <section id="notifications">
            <h4>08 — Notifications</h4>
            <h2>Toast Notifications</h2>
            <p className="section-note">
              Toasts use the 4-color pen system. Each type has a distinct color and icon. They appear bottom-right and auto-dismiss.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Success</div>
                <div className="toast success" style={{ marginTop: "8px" }}>
                  <div className="toast-icon">✓</div>
                  <div className="toast-content">
                    <div className="toast-title">Record saved</div>
                    <div className="toast-message">Maria Santos intake form saved successfully.</div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="label">Error</div>
                <div className="toast error" style={{ marginTop: "8px" }}>
                  <div className="toast-icon">✕</div>
                  <div className="toast-content">
                    <div className="toast-title">Recording failed</div>
                    <div className="toast-message">Microphone access was denied. Check permissions.</div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="label">Warning</div>
                <div className="toast warning" style={{ marginTop: "8px" }}>
                  <div className="toast-icon">!</div>
                  <div className="toast-content">
                    <div className="toast-title">Review required</div>
                    <div className="toast-message">3 fields have low confidence and need manual review.</div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="label">Info</div>
                <div className="toast info" style={{ marginTop: "8px" }}>
                  <div className="toast-icon">i</div>
                  <div className="toast-content">
                    <div className="toast-title">Sync in progress</div>
                    <div className="toast-message">Your records are syncing with the compliance system.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 09 — Marketing Patterns */}
          <section id="marketing">
            <h4>09 — Marketing Patterns</h4>
            <h2>Visual Textures</h2>
            <p className="section-note">
              Subtle patterns that add texture without being distracting. Used sparingly in marketing materials and hero sections.
            </p>

            <div className="grid2">
              <div className="card">
                <div className="label">Stipple Pattern</div>
                <div style={{ height: "120px", borderRadius: "var(--radius-md)", position: "relative", overflow: "hidden", background: "var(--paper-dim)" }}>
                  <div className="stipple-pattern" style={{ position: "absolute", inset: 0 }}></div>
                </div>
                <p className="t-caption" style={{ marginTop: "12px" }}>Radial gradient dots at 8px intervals, 8% opacity</p>
              </div>
              <div className="card">
                <div className="label">Cross-Hatch Pattern</div>
                <div style={{ height: "120px", borderRadius: "var(--radius-md)", position: "relative", overflow: "hidden", background: "var(--ink-blue)" }}>
                  <div className="cross-hatch" style={{ position: "absolute", inset: 0 }}></div>
                </div>
                <p className="t-caption" style={{ marginTop: "12px" }}>45° diagonal lines, 6% opacity on dark backgrounds</p>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <h3>Usage Guidelines</h3>
              <div className="grid2" style={{ marginTop: "16px" }}>
                <div>
                  <div className="label">Do Use</div>
                  <ul className="list">
                    <li>Hero section backgrounds</li>
                    <li>Marketing page dividers</li>
                    <li>Social media graphics</li>
                    <li>Presentation slides</li>
                  </ul>
                </div>
                <div>
                  <div className="label">Don't Use</div>
                  <ul className="list">
                    <li>Inside the product UI</li>
                    <li>On text-heavy sections</li>
                    <li>At high opacity (above 15%)</li>
                    <li>Overlapping multiple patterns</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 10 — Logo System */}
          <section id="logo">
            <h4>10 — Logo System</h4>
            <h2>The Inkra Mark</h2>
            <p className="section-note">
              The Inkra logo is a hand-drawn ink line that resembles a voice waveform. It suggests conversation, human touch, and the organic nature of speech.
            </p>

            <div className="grid2">
              <div className="card" style={{ textAlign: "center", padding: "32px" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
                  <svg viewBox="0 0 320 80" width="160" height="40">
                    <path d="M 20,42 C 28,42 34,40 42,38 C 50,36 54,34 60,30 C 64,27 66,24 70,20 C 74,16 78,14 82,18 C 86,22 88,30 92,36 C 96,42 98,46 102,48 C 106,50 108,44 112,36 C 116,28 118,18 122,12 C 126,6 130,4 134,10 C 138,16 140,28 144,38 C 148,48 150,54 154,56 C 158,58 160,52 164,44 C 168,36 170,26 174,20 C 178,14 182,14 186,18 C 190,22 192,30 196,36 C 200,42 204,46 210,46 C 216,46 222,44 230,43 C 238,42 248,41 260,41 C 272,41 284,41 296,41" fill="none" stroke="#1B2A4A" strokeWidth="5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em" }}>Inkra</span>
                </div>
                <p className="t-caption" style={{ marginTop: "16px" }}>Primary lockup — Mark + Wordmark</p>
              </div>
              <div className="card" style={{ textAlign: "center", padding: "32px", background: "#1B2A4A" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
                  <svg viewBox="0 0 320 80" width="160" height="40">
                    <path d="M 20,42 C 28,42 34,40 42,38 C 50,36 54,34 60,30 C 64,27 66,24 70,20 C 74,16 78,14 82,18 C 86,22 88,30 92,36 C 96,42 98,46 102,48 C 106,50 108,44 112,36 C 116,28 118,18 122,12 C 126,6 130,4 134,10 C 138,16 140,28 144,38 C 148,48 150,54 154,56 C 158,58 160,52 164,44 C 168,36 170,26 174,20 C 178,14 182,14 186,18 C 190,22 192,30 196,36 C 200,42 204,46 210,46 C 216,46 222,44 230,43 C 238,42 248,41 260,41 C 272,41 284,41 296,41" fill="none" stroke="#FAFAF8" strokeWidth="5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", color: "#FAFAF8" }}>Inkra</span>
                </div>
                <p className="t-caption" style={{ marginTop: "16px", color: "rgba(250,250,248,0.7)" }}>Reversed — On dark backgrounds</p>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <h3>Usage Rules</h3>
              <div className="grid3" style={{ marginTop: "16px" }}>
                <div>
                  <div className="label">Clear Space</div>
                  <p className="t-body">Minimum clear space equal to the height of the mark on all sides.</p>
                </div>
                <div>
                  <div className="label">Minimum Size</div>
                  <p className="t-body">Mark alone: 24px height. With wordmark: 32px height.</p>
                </div>
                <div>
                  <div className="label">Favicon</div>
                  <p className="t-body">Use the mark alone, centered in a square container.</p>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px", borderLeft: "3px solid var(--ink-amber)" }}>
              <h3 style={{ color: "var(--ink-amber)" }}>Note: SVG Approximation</h3>
              <p className="t-body" style={{ marginTop: "8px" }}>The actual mark has hand-drawn ink pressure variation that a uniform-width SVG path can't fully replicate. The final production logo should be vectorized from the approved artwork with variable-width stroke profiles preserved.</p>
            </div>
          </section>

          {/* 11 — Design Tokens */}
          <section id="tokens">
            <h4>11 — Design Tokens</h4>
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
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Font Family Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`/* Font Families */
--font-serif:   'Tiempos Text', Georgia, serif;
--font-sans:    'Soehne', system-ui, sans-serif;
--font-display: 'Soehne Breit', 'Soehne', sans-serif;
--font-mono:    'SF Mono', 'Fira Code', monospace;`}
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Typography Tokens</div>
              <table className="token-table" style={{ marginTop: "12px" }}>
                <thead>
                  <tr><th>Token</th><th>Font</th><th>Size</th><th>Weight</th><th>Usage</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>--type-display</code></td><td>Tiempos</td><td>48px</td><td>400</td><td>Hero headlines</td></tr>
                  <tr><td><code>--type-h1</code></td><td>Tiempos</td><td>32px</td><td>600</td><td>Section headings</td></tr>
                  <tr><td><code>--type-h2</code></td><td>Tiempos</td><td>22px</td><td>400</td><td>Card titles</td></tr>
                  <tr><td><code>--type-body</code></td><td>Soehne</td><td>14px</td><td>300</td><td>Body text</td></tr>
                  <tr><td><code>--type-body-medium</code></td><td>Soehne</td><td>14px</td><td>500</td><td>Emphasized body</td></tr>
                  <tr><td><code>--type-caption</code></td><td>Soehne</td><td>13px</td><td>300</td><td>Metadata</td></tr>
                  <tr><td><code>--type-label</code></td><td>Soehne</td><td>11px</td><td>500</td><td>Section labels</td></tr>
                  <tr><td><code>--type-mono</code></td><td>SF Mono</td><td>12px</td><td>400</td><td>Code, timestamps</td></tr>
                </tbody>
              </table>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Spacing Tokens</div>
              <table className="token-table" style={{ marginTop: "12px" }}>
                <thead>
                  <tr><th>Token</th><th>Value</th><th>Usage</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>--space-xs</code></td><td>4px</td><td>Tight gaps</td></tr>
                  <tr><td><code>--space-sm</code></td><td>8px</td><td>Icon gaps, chip padding</td></tr>
                  <tr><td><code>--space-md</code></td><td>16px</td><td>Card padding, form gaps</td></tr>
                  <tr><td><code>--space-lg</code></td><td>24px</td><td>Section padding</td></tr>
                  <tr><td><code>--space-xl</code></td><td>40px</td><td>Section breaks</td></tr>
                  <tr><td><code>--space-2xl</code></td><td>64px</td><td>Page sections</td></tr>
                </tbody>
              </table>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Motion Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`/* Inkra Motion */
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
--ease-soft: cubic-bezier(0.2, 0.8, 0.2, 1);
--fast:      120ms;   /* hover, focus */
--normal:    240ms;   /* transitions */
--slow:      600ms;   /* ink settling, page transitions */

/* Voice blob animation */
--blob-duration: 1400ms;
--blob-easing:   cubic-bezier(0.2, 0.8, 0.2, 1);`}
              </div>
            </div>

            <div className="card" style={{ marginTop: "20px" }}>
              <div className="label">Shadow & Radius Tokens</div>
              <div className="code-block" style={{ marginTop: "12px" }}>
{`--shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-md: 0 4px 12px rgba(0,0,0,0.06);
--shadow-lg: 0 12px 40px rgba(0,0,0,0.08);

--radius-sm: 6px;    /* chips, small elements */
--radius-md: 10px;   /* buttons, inputs */
--radius-lg: 14px;   /* cards, modals */
--radius-pill: 999px; /* chips, dots, toggles */`}
              </div>
            </div>
          </section>

          {/* 12 — Loading States */}
          <section id="loading">
            <h4>12 — Loading States</h4>
            <h2>Doodle Loading — Phase 2</h2>
            <p className="section-note">
              A future brand layer. During loading screens (recording initializing, AI processing, generating reports), the UI shows small sketch-like doodle animations — as if someone is drawing while on the phone. This humanizes wait times and reinforces the conversation-to-work metaphor.
            </p>

            <div className="grid2">
              <div className="card">
                <h3>Style Rules</h3>
                <ul className="list">
                  <li><strong>Stroke:</strong> 1–1.5px, Ink at 30–50% opacity</li>
                  <li><strong>Motion:</strong> Lines draw slowly (600–1200ms). Feels like someone drawing.</li>
                  <li><strong>Content:</strong> Quick note scribbles, small arrows, circles, underlines, tiny diagrams.</li>
                  <li><strong>Never:</strong> Cartoonish, playful illustrations, thick lines, bright colors.</li>
                </ul>
              </div>
              <div className="card">
                <h3>Where Doodles Appear</h3>
                <p className="t-body" style={{ marginTop: "8px" }}>Recording initializing, AI processing, generating reports, joining meetings, syncing records. Not in core product chrome — only in transitional moments.</p>
                <p className="t-body" style={{ marginTop: "16px", color: "var(--ink-amber)" }}><strong>Status:</strong> Documented for Phase 2. Not required for MVP.</p>
              </div>
            </div>
          </section>

          <footer>
            <div>Inkra Design System • Conversation-to-Work Platform • v1 • February 2026</div>
            <div><a href="#top">Back to top</a></div>
          </footer>
        </div>
      </div>
    </>
  );
}
