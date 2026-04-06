"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
  HowToJsonLd,
  inkraFAQs,
} from "@/components/seo/json-ld";
import { ProductDemo } from "@/components/marketing/product-demo";
import { MarketingFooter } from "@/components/marketing/footer";

const useCases = [
  { name: "Nonprofits", href: "/use-cases/nonprofits" },
  { name: "Healthcare", href: "/use-cases/healthcare" },
  { name: "Sales", href: "/use-cases/sales" },
  { name: "UX Research", href: "/use-cases/ux-research" },
  { name: "Legal", href: "/use-cases/legal" },
];

// Form submission state type
type FormStatus = "idle" | "submitting" | "success" | "error" | "duplicate";

interface FormState {
  status: FormStatus;
  message: string;
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formState, setFormState] = useState<FormState>({
    status: "idle",
    message: "",
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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

    // Blob animation
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const np = 12;
    const radius = 55;
    const maxR = 30;
    // Theme-aware blob color
    const isDark = document.documentElement.classList.contains("dark");
    let color = isDark ? "#8A9EC8" : "#1B2A4A";
    const div = (Math.PI * 2) / np;

    // Watch for theme changes
    const themeObserver = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      color = nowDark ? "#8A9EC8" : "#1B2A4A";
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    class Point {
      azimuth: number;
      cx: number;
      cy: number;
      radius: number;
      _c: { x: number; y: number };
      acceleration: number;
      speed: number;
      radialEffect: number;
      elasticity: number;
      friction: number;

      constructor(az: number, cx: number, cy: number, r: number) {
        this.azimuth = Math.PI - az;
        this.cx = cx;
        this.cy = cy;
        this.radius = r;
        this._c = { x: Math.cos(this.azimuth), y: Math.sin(this.azimuth) };
        this.acceleration = -0.3 + Math.random() * 0.6;
        this.speed = 0.002 + Math.random() * 0.002;
        this.radialEffect = 0;
        this.elasticity = 0.001;
        this.friction = 0.0085;
      }

      solveWith(l: Point, r: Point) {
        this.acceleration =
          (-0.3 * this.radialEffect +
            (l.radialEffect - this.radialEffect) +
            (r.radialEffect - this.radialEffect)) *
            this.elasticity -
          this.speed * this.friction;
      }

      get position() {
        return {
          x: this.cx + this._c.x * (this.radius + this.radialEffect),
          y: this.cy + this._c.y * (this.radius + this.radialEffect),
        };
      }
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const points: Point[] = [];
    for (let i = 0; i < np; i++) {
      points.push(new Point(div * (i + 1), cx, cy, radius));
    }

    let target = 0.5;
    let cur = 0.5;

    // Simulate speech
    const pulse = () => {
      target =
        Math.random() > 0.3
          ? 0.4 + Math.random() * 0.6
          : 0.05 + Math.random() * 0.1;
      setTimeout(pulse, 150 + Math.random() * 500);
    };
    pulse();

    const drawHalf = (flip: boolean) => {
      points.forEach((p) => {
        p.cx = cx;
        p.cy = cy;
      });
      points[0].solveWith(points[np - 1], points[1]);
      let p0 = points[np - 1].position;
      let p1 = points[0].position;
      if (flip) {
        p0 = { x: 2 * cx - p0.x, y: p0.y };
        p1 = { x: 2 * cx - p1.x, y: p1.y };
      }
      ctx.beginPath();
      ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      for (let i = 1; i < np; i++) {
        points[i].solveWith(points[i - 1], points[i + 1] || points[0]);
        let p2 = points[i].position;
        if (flip) p2 = { x: 2 * cx - p2.x, y: p2.y };
        ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        p1 = p2;
      }
      let pf = points[0].position;
      if (flip) pf = { x: 2 * cx - pf.x, y: pf.y };
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + pf.x) / 2, (p1.y + pf.y) / 2);
      ctx.closePath();
      ctx.fill();
    };

    let animationId: number;
    const frame = () => {
      cur += (target - cur) * 0.06;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < np; i++) {
        const p = points[i];
        p.elasticity = 0.001 + cur * 0.003;
        p.friction = 0.0085 + (1 - cur) * 0.005;
        const drive =
          Math.sin(Date.now() * 0.003 * (i + 1) * 0.3) * cur * maxR;
        p.radialEffect += (drive - p.radialEffect) * 0.03;
        p.speed += p.acceleration;
        p.radialEffect += p.speed;
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6 + cur * 0.25;
      drawHalf(false);
      ctx.globalAlpha = 0.45 + cur * 0.25;
      drawHalf(true);
      // Shadow layer
      ctx.globalAlpha = 0.06 + cur * 0.04;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.2, 1.2);
      ctx.translate(-cx, -cy);
      drawHalf(false);
      drawHalf(true);
      ctx.restore();
      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent double submission
    if (formState.status === "submitting") return;

    setFormState({ status: "submitting", message: "" });

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      organization: formData.get("organization") as string,
      role: formData.get("role") as string,
      teamSize: formData.get("teamSize") as string,
      industry: formData.get("industry") as string,
    };

    try {
      // Call the app domain's API for waitlist submissions
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.oninkra.com";
      const response = await fetch(`${appUrl}/api/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Check if duplicate
        if (result.duplicate) {
          setFormState({
            status: "duplicate",
            message: result.message || "You're already on the list!",
          });
        } else {
          setFormState({
            status: "success",
            message: result.message || "You're on the list! We'll notify you when your access is ready.",
          });
        }
      } else {
        // Handle errors
        const errorMessage = result.error?.message || "Something went wrong. Please try again.";
        setFormState({
          status: "error",
          message: errorMessage,
        });
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setFormState({
        status: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  };

  return (
    <>
      {/* SEO: Structured Data for Search Engines and AI Agents */}
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <FAQJsonLd questions={inkraFAQs} />
      <HowToJsonLd
        name="How to automate documentation with Inkra"
        description="Get structured case notes, forms, and compliance reports from conversations automatically"
        steps={[
          { name: "Apply for pilot", text: "Submit your application at inkra.ai to join the Spring 2026 pilot program" },
          { name: "Connect your channels", text: "Link your VoIP phone, Zoom, Google Meet, or Teams accounts" },
          { name: "Have conversations", text: "Talk to clients, patients, or customers as you normally would" },
          { name: "Review outputs", text: "Inkra automatically generates case notes, forms, tasks, and reports for review" },
        ]}
      />

      <style jsx global>{`
        :root {
          --paper: #FAFAF8;
          --paper-warm: #F5F4F0;
          --paper-dim: #EEEDEA;
          --ink: #111111;
          --ink-soft: #3A3A3A;
          --ink-muted: #6B6B6B;
          --ink-faint: #A1A1A1;
          --border: #DADAD7;
          --border-light: #E8E8E5;
          /* Ink Blue - Two-Register System for A11y */
          --ink-blue: #1B2A4A;        /* Surfaces: nav bg, CTA sections */
          --ink-blue-accent: #2B4C8C; /* Text & buttons: headlines, links */
          --ink-blue-mid: #244280;    /* Hover state */
          --ink-blue-wash: rgba(43,76,140,0.08);
          --ink-blue-ghost: rgba(43,76,140,0.04);
          --ink-red: #B34747;
          --ink-green: #3F6F5A;
          --ink-amber: #B26A00;
          --sans: 'Soehne', var(--font-inter), -apple-system, system-ui, sans-serif;
          --serif: 'Tiempos Text', Georgia, serif;
          --display: 'Soehne Breit', 'Soehne', var(--font-inter), sans-serif;
          --ease: cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Dark mode */
        .dark {
          --paper: #0F1014;
          --paper-warm: #151619;
          --paper-dim: #1C1D22;
          --ink: #E8E8E5;
          --ink-soft: #C4C4C0;
          --ink-muted: #8A8A86;
          --ink-faint: #6E6E6B;
          --border: #3A3B42;
          --border-light: #2F3034;
          --ink-blue: #3D5A94;
          --ink-blue-accent: #A8B8D8;
          --ink-blue-mid: #344F88;
          --ink-blue-wash: rgba(138,158,200,0.10);
          --ink-blue-ghost: rgba(138,158,200,0.05);
          --ink-red: #E07070;
          --ink-green: #6BAA90;
          --ink-amber: #D4A24C;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
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
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 16px 32px;
          display: flex; align-items: center; justify-content: space-between;
          background: color-mix(in srgb, var(--paper) 80%, transparent);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
        }
        .nav-left { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .nav-mark { display: flex; align-items: center; }
        .nav-mark svg { display: block; }
        .nav-name { font-size: 18px; font-weight: 800; letter-spacing: -0.04em; }
        .nav-center { display: flex; align-items: center; gap: 32px; }
        .nav-link { font-size: 14px; font-weight: 500; color: var(--ink-muted); text-decoration: none; transition: color 0.2s var(--ease); }
        .nav-link:hover { color: var(--ink-blue-accent); }
        .nav-dropdown { position: relative; }
        .nav-dropdown-trigger {
          display: flex; align-items: center; gap: 4px;
          font-size: 14px; font-weight: 500; color: var(--ink-muted);
          cursor: pointer; transition: color 0.2s var(--ease);
          background: none; border: none; padding: 0; font-family: inherit;
        }
        .nav-dropdown-trigger:hover { color: var(--ink-blue-accent); }
        .nav-dropdown-trigger svg { transition: transform 0.2s var(--ease); }
        .nav-dropdown:hover .nav-dropdown-trigger svg { transform: rotate(180deg); }
        .nav-dropdown-menu {
          position: absolute; top: calc(100% + 12px); left: 50%;
          transform: translateX(-50%); background: var(--paper);
          border: 1px solid var(--border); border-radius: 12px;
          padding: 8px; min-width: 180px;
          opacity: 0; visibility: hidden;
          transform: translateX(-50%) translateY(8px);
          transition: all 0.2s var(--ease);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }
        .nav-dropdown:hover .nav-dropdown-menu {
          opacity: 1; visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
        .nav-dropdown-link {
          display: block; padding: 10px 14px;
          font-size: 14px; color: var(--ink-soft);
          text-decoration: none; border-radius: 8px;
          transition: all 0.15s var(--ease);
        }
        .nav-dropdown-link:hover { background: var(--ink-blue-wash); color: var(--ink-blue-accent); }
        .nav-cta {
          font-family: var(--sans); font-size: 14px; font-weight: 600;
          padding: 10px 20px; background: var(--ink-blue); color: #fff;
          border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.2s var(--ease); text-decoration: none;
        }
        .nav-cta:hover { background: var(--ink-blue-mid); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(27,42,74,0.2); }
        .nav-hamburger {
          display: none; flex-direction: column; gap: 5px;
          padding: 8px; background: none; border: none; cursor: pointer;
        }
        .nav-hamburger span { display: block; width: 20px; height: 2px; background: var(--ink); border-radius: 1px; }
        /* Mobile Menu */
        .mobile-menu-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.4); z-index: 99;
          opacity: 0; transition: opacity 0.3s var(--ease);
        }
        .mobile-menu-overlay.open { opacity: 1; }
        .mobile-menu {
          display: none; position: fixed; top: 0; right: 0; bottom: 0;
          width: min(320px, 85vw); background: var(--paper); z-index: 101;
          padding: 24px; transform: translateX(100%);
          transition: transform 0.3s var(--ease); overflow-y: auto;
        }
        .mobile-menu.open { transform: translateX(0); }
        .mobile-menu-header { display: flex; justify-content: flex-end; margin-bottom: 32px; }
        .mobile-menu-close { padding: 8px; background: none; border: none; cursor: pointer; color: var(--ink-muted); }
        .mobile-menu-links { display: flex; flex-direction: column; gap: 8px; }
        .mobile-menu-link {
          font-size: 16px; font-weight: 500; color: var(--ink-soft);
          text-decoration: none; padding: 12px 16px; border-radius: 10px;
          transition: all 0.15s var(--ease);
        }
        .mobile-menu-link:hover { background: var(--ink-blue-wash); color: var(--ink-blue-accent); }
        .mobile-menu-dropdown { border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
        .mobile-menu-dropdown-trigger {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 12px 16px; font-size: 16px; font-weight: 500;
          color: var(--ink-soft); background: none; border: none; cursor: pointer; font-family: inherit;
        }
        .mobile-menu-dropdown-trigger svg { transition: transform 0.2s var(--ease); }
        .mobile-menu-dropdown-trigger.open svg { transform: rotate(180deg); }
        .mobile-menu-dropdown-content { display: none; padding: 0 8px 8px; }
        .mobile-menu-dropdown-content.open { display: block; }
        .mobile-menu-dropdown-link {
          display: block; padding: 10px 16px; font-size: 14px;
          color: var(--ink-muted); text-decoration: none; border-radius: 8px;
          transition: all 0.15s var(--ease);
        }
        .mobile-menu-dropdown-link:hover { background: var(--ink-blue-ghost); color: var(--ink-blue-accent); }
        .mobile-menu-cta {
          display: block; margin-top: 24px; padding: 14px;
          background: var(--ink-blue); color: #fff;
          font-size: 15px; font-weight: 600; text-align: center;
          text-decoration: none; border-radius: 10px;
          transition: all 0.2s var(--ease);
        }
        .mobile-menu-cta:hover { background: var(--ink-blue-mid); }
        @media (max-width: 768px) {
          .nav { padding: 12px 20px; }
          .nav-center { display: none; }
          .nav-cta.desktop { display: none; }
          .nav-hamburger { display: flex; }
          .mobile-menu-overlay { display: block; }
          .mobile-menu { display: block; }
        }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 120px 32px 80px;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, var(--ink-blue) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.03; pointer-events: none;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 500; color: var(--ink-blue-accent);
          background: var(--ink-blue-wash); padding: 8px 16px;
          border-radius: 999px; margin-bottom: 32px;
          animation: fadeUp 0.8s var(--ease) both;
        }
        .hero-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ink-blue-accent); }
        .hero h1 {
          font-family: var(--serif); font-weight: 400;
          font-size: clamp(42px, 6vw, 72px);
          line-height: 1.1; letter-spacing: -0.02em;
          max-width: 780px; margin-bottom: 24px;
          animation: fadeUp 0.8s 0.1s var(--ease) both;
        }
        .hero h1 em { font-style: italic; color: var(--ink-blue-accent); }
        .hero-sub {
          font-size: 18px; line-height: 1.6; color: var(--ink-muted);
          max-width: 520px; margin-bottom: 40px;
          animation: fadeUp 0.8s 0.2s var(--ease) both;
        }
        .hero-cta-row {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center;
          animation: fadeUp 0.8s 0.3s var(--ease) both;
        }
        .btn-primary {
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          padding: 14px 28px; background: var(--ink-blue); color: #fff;
          border: none; border-radius: 10px; cursor: pointer;
          transition: all 0.2s var(--ease);
          box-shadow: 0 1px 3px rgba(27,42,74,0.15);
        }
        .btn-primary:hover { background: var(--ink-blue-mid); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(27,42,74,0.2); }
        .btn-ghost {
          font-family: var(--sans); font-size: 15px; font-weight: 500;
          padding: 14px 24px; background: none; color: var(--ink-muted);
          border: 1px solid var(--border); border-radius: 10px; cursor: pointer;
          transition: all 0.2s var(--ease);
        }
        .btn-ghost:hover { border-color: var(--ink-blue-accent); color: var(--ink-blue-accent); }
        .hero-note { font-size: 12px; color: var(--ink-faint); margin-top: 12px; }
        .hero-blob {
          margin-top: 64px; width: 100%; max-width: 480px; height: 140px;
          animation: fadeUp 0.8s 0.5s var(--ease) both;
        }
        .hero-blob canvas { display: block; width: 100%; height: 100%; }

        /* TRUST BAR */
        .trust-bar {
          display: flex; align-items: center; justify-content: center;
          gap: 32px; padding: 24px 32px;
          border-top: 1px solid var(--border-light);
          border-bottom: 1px solid var(--border-light);
          flex-wrap: wrap;
        }
        .trust-item {
          font-size: 12px; font-weight: 600; color: var(--ink-muted);
          letter-spacing: 0.04em; text-transform: uppercase;
          display: flex; align-items: center; gap: 6px;
        }
        .trust-item::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ink-green); }

        /* SECTIONS */
        .section { padding: 100px 32px; }
        .section-inner { max-width: 1080px; margin: 0 auto; }
        .section-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--ink-muted); margin-bottom: 16px;
        }
        .section-title {
          font-family: var(--serif); font-weight: 400;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.15; letter-spacing: -0.015em;
          margin-bottom: 20px;
        }
        .section-title em { font-style: italic; color: var(--ink-blue-accent); }
        .section-subtitle {
          font-size: 16px; color: var(--ink-muted); margin-bottom: 48px;
          max-width: 480px; line-height: 1.6;
        }
        .demo-wrapper { margin-top: 0; }

        /* STATS GRID */
        .stats-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
          background: var(--border-light); border: 1px solid var(--border-light);
          border-radius: 16px; overflow: hidden; margin-top: 48px;
        }
        .stat {
          background: var(--paper); padding: 40px 28px;
          text-align: center;
        }
        .stat-num {
          font-family: var(--serif); font-size: 48px; font-weight: 400;
          color: var(--ink-blue-accent); line-height: 1; margin-bottom: 8px;
        }
        .stat-label { font-size: 14px; color: var(--ink-muted); line-height: 1.4; }

        /* TESTIMONIAL */
        .testimonial-section {
          padding: 80px 32px;
          background: var(--ink-blue);
          color: #fff;
          position: relative; overflow: hidden;
        }
        .testimonial-section::before {
          content: ''; position: absolute; inset: 0;
          background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 16px);
          pointer-events: none;
        }
        .testimonial-inner { max-width: 720px; margin: 0 auto; position: relative; text-align: center; }
        .testimonial-quote {
          font-family: var(--serif); font-style: italic;
          font-size: clamp(20px, 2.5vw, 28px);
          line-height: 1.5; margin-bottom: 32px; opacity: 0.95;
        }
        .testimonial-attr { font-size: 14px; opacity: 0.6; }
        .testimonial-context { font-size: 13px; opacity: 0.4; margin-top: 8px; }

        /* HOW IT WORKS */
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 48px; }
        .step {
          padding: 40px 32px;
          border: 1px solid var(--border-light);
          position: relative;
        }
        .step:first-child { border-radius: 16px 0 0 16px; }
        .step:last-child { border-radius: 0 16px 16px 0; }
        .step-num {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          color: var(--ink-blue-accent); margin-bottom: 20px;
        }
        .step h3 {
          font-family: var(--serif); font-size: 22px; font-weight: 400;
          margin-bottom: 12px;
        }
        .step p { font-size: 14px; color: var(--ink-muted); line-height: 1.6; }
        .step:not(:last-child)::after {
          content: '→'; position: absolute; right: -12px; top: 50%;
          transform: translateY(-50%);
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--paper); border: 1px solid var(--border);
          display: grid; place-items: center;
          font-size: 14px; color: var(--ink-blue-accent); z-index: 2;
        }

        /* INDUSTRY STORIES */
        .story {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0;
          border: 1px solid var(--border-light); border-radius: 16px;
          overflow: hidden; margin-top: 24px;
        }
        .story:nth-child(even) .story-content { order: 2; }
        .story:nth-child(even) .story-visual { order: 1; }
        .story-content { padding: 48px 40px; display: flex; flex-direction: column; justify-content: center; }
        .story-tag {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--ink-blue-accent); margin-bottom: 16px;
        }
        .story-content h2 {
          font-family: var(--serif); font-size: 24px; font-weight: 400;
          line-height: 1.3; margin-bottom: 16px;
        }
        .story-content p { font-size: 14px; color: var(--ink-muted); line-height: 1.65; margin-bottom: 16px; }
        .story-with {
          font-size: 13px; font-weight: 600; color: var(--ink-green);
          margin-bottom: 8px;
        }
        .story-benefit { font-size: 14px; color: var(--ink-soft); line-height: 1.6; }
        .story-visual {
          background: var(--paper-dim); display: flex;
          align-items: center; justify-content: center;
          padding: 40px; min-height: 320px;
          position: relative; overflow: hidden;
        }
        .story:nth-child(odd) .story-visual::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, var(--ink-blue) 1px, transparent 1px);
          background-size: 18px 18px; opacity: 0.05; pointer-events: none;
        }
        .story:nth-child(even) .story-visual::before {
          content: ''; position: absolute; inset: 0;
          background-image: repeating-linear-gradient(45deg, var(--ink-blue) 0 1px, transparent 1px 12px);
          opacity: 0.04; pointer-events: none;
        }
        .story-mockup {
          background: var(--paper); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px; width: 100%; max-width: 340px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.06);
          position: relative; z-index: 1;
        }
        .mockup-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .mockup-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--ink-blue-wash); color: var(--ink-blue-accent);
          display: grid; place-items: center; font-size: 12px; font-weight: 700;
        }
        .mockup-name { font-size: 14px; font-weight: 600; }
        .mockup-meta { font-size: 12px; color: var(--ink-muted); }
        .mockup-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-top: 1px solid var(--border-light);
          font-size: 13px;
        }
        .mockup-label { color: var(--ink-muted); }
        .mockup-value { font-weight: 500; }
        .mockup-chip {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; padding: 3px 8px;
          border-radius: 999px;
        }
        .mockup-chip.green { background: rgba(63,111,90,0.1); color: var(--ink-green); }
        .mockup-chip.blue { background: var(--ink-blue-wash); color: var(--ink-blue-accent); }
        .mockup-chip.amber { background: rgba(178,106,0,0.1); color: var(--ink-amber); }

        /* ENGINES GRID */
        .engines {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 1px; background: var(--border-light);
          border: 1px solid var(--border-light);
          border-radius: 16px; overflow: hidden; margin-top: 48px;
        }
        .engine { background: var(--paper); padding: 32px 24px; }
        .engine-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--ink-blue-wash); display: grid; place-items: center;
          font-size: 18px; margin-bottom: 16px;
        }
        .engine h4 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .engine p { font-size: 13px; color: var(--ink-muted); line-height: 1.5; }

        /* INDUSTRIES BAR */
        .industries {
          display: flex; flex-wrap: wrap; gap: 8px;
          justify-content: center; margin-top: 32px;
        }
        .ind-chip {
          font-size: 13px; font-weight: 500; color: var(--ink-muted);
          padding: 8px 16px; border: 1px solid var(--border);
          border-radius: 999px; transition: all 0.2s var(--ease);
        }
        .ind-chip:hover { border-color: var(--ink-blue-accent); color: var(--ink-blue-accent); background: var(--ink-blue-wash); }

        /* CTA SECTION */
        .cta-section {
          padding: 100px 32px;
          background: var(--ink-blue);
          color: #fff;
          text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: ''; position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 20px 20px; pointer-events: none;
        }
        .cta-inner { max-width: 560px; margin: 0 auto; position: relative; }
        .cta-section h2 {
          font-family: var(--serif); font-size: clamp(32px, 4vw, 44px);
          font-weight: 400; line-height: 1.2; margin-bottom: 16px;
        }
        .cta-section h2 em { font-style: italic; }
        .cta-section p { font-size: 16px; opacity: 0.7; margin-bottom: 32px; line-height: 1.6; }
        .btn-white {
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          padding: 14px 32px; background: #fff; color: var(--ink-blue);
          border: none; border-radius: 10px; cursor: pointer;
          transition: all 0.2s var(--ease);
        }
        .btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .cta-note { font-size: 12px; opacity: 0.4; margin-top: 12px; }

        /* WAITLIST FORM */
        .wl-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          text-align: left;
          margin-bottom: 12px;
        }
        .wl-form .full { grid-column: 1 / -1; }
        .wl-form input,
        .wl-form select {
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.1);
          color: #fff;
          font-family: var(--sans);
          font-size: 14px;
          outline: none;
          transition: all 0.2s var(--ease);
          width: 100%;
        }
        .wl-form input::placeholder { color: rgba(255,255,255,0.5); }
        .wl-form input:focus,
        .wl-form select:focus {
          border-color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.15);
        }
        .wl-form select {
          appearance: none;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
        }
        .wl-form select:valid { color: #fff; }
        .wl-form select option { background: var(--ink-blue); color: #fff; }
        .wl-btn {
          grid-column: 1 / -1;
          padding: 16px;
          border-radius: 10px;
          background: #fff;
          color: var(--ink-blue);
          font-family: var(--sans);
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s var(--ease);
        }
        .wl-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .wl-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .wl-btn:disabled:hover {
          transform: none;
          box-shadow: none;
        }
        .wl-form input:disabled,
        .wl-form select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .wl-error {
          background: rgba(220, 38, 38, 0.15);
          border: 1px solid rgba(220, 38, 38, 0.4);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
          color: #fca5a5;
          text-align: center;
        }
        .wl-confirmation {
          text-align: center;
          padding: 40px 20px;
          animation: fadeUp 0.5s var(--ease) both;
        }
        .wl-confirmation-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 28px;
          color: #fff;
        }
        .wl-confirmation-title {
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 400;
          margin-bottom: 12px;
        }
        .wl-confirmation-message {
          font-size: 15px;
          opacity: 0.8;
          line-height: 1.6;
          max-width: 400px;
          margin: 0 auto;
        }
        @media (max-width: 600px) {
          .wl-form { grid-template-columns: 1fr; }
          .wl-form .full { grid-column: 1; }
        }

        /* FOOTER - using MarketingFooter component */

        /* ANIMATIONS */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reveal {
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
        }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: 1fr 1fr; }
          .steps { grid-template-columns: 1fr; }
          .step { border-radius: 0 !important; }
          .step:first-child { border-radius: 16px 16px 0 0 !important; }
          .step:last-child { border-radius: 0 0 16px 16px !important; }
          .step:not(:last-child)::after { display: none; }
          .story { grid-template-columns: 1fr; }
          .story-visual { min-height: 240px; }
          .story:nth-child(even) .story-content { order: 1; }
          .story:nth-child(even) .story-visual { order: 2; }
          .engines { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .engines { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-left">
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

        {/* Desktop Nav */}
        <div className="nav-center">
          <Link href="/features" className="nav-link">Features</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
          <div className="nav-dropdown">
            <button className="nav-dropdown-trigger">
              Use Cases
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="nav-dropdown-menu">
              {useCases.map((uc) => (
                <Link key={uc.href} href={uc.href} className="nav-dropdown-link">
                  {uc.name}
                </Link>
              ))}
            </div>
          </div>
          <Link href="/blog" className="nav-link">Blog</Link>
        </div>

        <button className="nav-cta desktop" onClick={() => scrollTo("cta")}>
          Join the Pilot
        </button>

        {/* Mobile Hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`mobile-menu-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-menu-header">
          <button
            className="mobile-menu-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mobile-menu-links">
          <Link
            href="/features"
            className="mobile-menu-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="mobile-menu-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>

          <div className="mobile-menu-dropdown">
            <button
              className={`mobile-menu-dropdown-trigger ${useCasesOpen ? "open" : ""}`}
              onClick={() => setUseCasesOpen(!useCasesOpen)}
            >
              Use Cases
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className={`mobile-menu-dropdown-content ${useCasesOpen ? "open" : ""}`}>
              {useCases.map((uc) => (
                <Link
                  key={uc.href}
                  href={uc.href}
                  className="mobile-menu-dropdown-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {uc.name}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/blog"
            className="mobile-menu-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Blog
          </Link>
        </div>

        <Link
          href="/#cta"
          className="mobile-menu-cta"
          onClick={() => setMobileMenuOpen(false)}
        >
          Join the Pilot
        </Link>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">Workflow Automation Platform</div>
        <h1>
          Your words become
          <br />
          <em>completed work.</em>
        </h1>
        <p className="hero-sub">
          Inkra joins your calls and meetings, listens to what&apos;s discussed,
          and automatically completes the work that comes after.
        </p>
        <div className="hero-cta-row">
          <button className="btn-primary" onClick={() => scrollTo("cta")}>
            Join the Spring 2026 Pilot →
          </button>
          <button className="btn-ghost" onClick={() => scrollTo("how")}>
            See how it works
          </button>
        </div>
        <p className="hero-note">20 spots · reviewed weekly</p>
        <div className="hero-blob">
          <canvas ref={canvasRef} width={960} height={280} />
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="trust-bar">
        <span className="trust-item">HIPAA Compliant</span>
        <span className="trust-item">End-to-End Encrypted</span>
        <span className="trust-item">Your Data Never Trains Models</span>
        <span className="trust-item">Full Audit Trail</span>
      </div>

      {/* PROBLEM */}
      <section className="section">
        <div className="section-inner reveal">
          <div className="section-label">The problem nobody solves</div>
          <div className="section-title">
            Your team does the work twice.
            <br />
            <em>Once</em> with people. Once with <em>systems.</em>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-num">16 hrs</div>
              <div className="stat-label">
                per week on documentation
                <br />
                that could be automatic
              </div>
            </div>
            <div className="stat">
              <div className="stat-num">5×</div>
              <div className="stat-label">
                the same information
                <br />
                entered into different systems
              </div>
            </div>
            <div className="stat">
              <div className="stat-num">60%</div>
              <div className="stat-label">
                of organizational knowledge
                <br />
                lives in someone&apos;s head
              </div>
            </div>
            <div className="stat">
              <div className="stat-num">20+ hrs</div>
              <div className="stat-label">
                quarterly compiling
                <br />
                reports from memory
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="testimonial-section">
        <div className="testimonial-inner reveal">
          <div className="testimonial-quote">
            &quot;This would allow us to scale. We wouldn&apos;t have to focus
            so much on our reporting side of things. It would alleviate the
            hassle. Let the people work with people.&quot;
          </div>
          <div className="testimonial-attr">
            Karley, Director of Reentry Services · Family Assistant
          </div>
          <div className="testimonial-context">
            $30M nonprofit · 400 clients/week · 14 partner organizations
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="section-inner reveal">
          <div className="section-label">How it works</div>
          <div className="section-title">
            Your words become
            <br />
            <em>completed work.</em>
          </div>
          <p className="section-subtitle">
            Watch a live session. Left side: the conversation. Right side: what
            Inkra completes automatically.
          </p>
          <div className="demo-wrapper">
            <ProductDemo />
          </div>
        </div>
      </section>

      {/* INDUSTRY STORIES */}
      <section className="section">
        <div className="section-inner">
          <div className="section-label reveal">Sound familiar?</div>
          <div className="section-title reveal">
            One platform. Every team.
            <br />
            <em>Every conversation becomes an output.</em>
          </div>

          {/* Sales */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Sales & Account Management</div>
              <h2>
                Your top rep closes because they remember the little things.
              </h2>
              <p>
                Jordan remembers his prospect&apos;s kid just started Little
                League. He brings it up on the call. The prospect lights up.
                But when Jordan gets promoted, $2M in pipeline goes cold
                overnight.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Every call auto-captures relationship details, org chart intel,
                and budget timing. When reps move up, the next person inherits a
                living relationship, not an empty record.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">DC</div>
                  <div>
                    <div className="mockup-name">David Chen</div>
                    <div className="mockup-meta">VP Eng · Acme Corp</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Last call</span>
                  <span className="mockup-value">2 days ago</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Deal stage</span>
                  <span className="mockup-chip blue">Proposal sent</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Personal note</span>
                  <span className="mockup-value" style={{ fontSize: "12px" }}>
                    Maya: Little League playoffs
                  </span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Next action</span>
                  <span className="mockup-chip green">Follow up Thu</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nonprofits */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Nonprofit Case Management</div>
              <h2>
                Your case managers chose this work to help people. Not fill out
                forms.
              </h2>
              <p>
                Maria serves 400 clients weekly across 14 partner organizations.
                Every call generates paperwork: the same data, 3 to 5 times. Every
                quarterly report: 20+ hours reconstructing from memory.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Calls auto-document. Grant reports auto-generate with
                narratives, not just numbers. Photo-upload attendance handles
                group sessions where devices aren&apos;t allowed.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">JW</div>
                  <div>
                    <div className="mockup-name">James Walker</div>
                    <div className="mockup-meta">Reentry Support · Step 3/5</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Housing</span>
                  <span className="mockup-chip green">Stable</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Employment</span>
                  <span className="mockup-chip amber">Interview Thu</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Compliance</span>
                  <span className="mockup-chip green">On track</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Grant reporting</span>
                  <span className="mockup-value">Auto-updated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Healthcare */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Healthcare & Medical</div>
              <h2>
                Your patients come back for session 4. Do you remember sessions
                1 through 3?
              </h2>
              <p>
                Dr. Okafor sees 25 patients daily. Each has a multi-visit
                treatment plan. She spends 90 minutes after clinic writing SOAP
                notes. Her biller waits. The front desk has no context when
                patients call between visits.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                SOAP notes auto-generate. Treatment tracks across all sessions.
                Billing docs ready before checkout. Every conversation becomes
                billable revenue.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">SM</div>
                  <div>
                    <div className="mockup-name">Sarah M.</div>
                    <div className="mockup-meta">Session 4 of 6 · PT</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">SOAP note</span>
                  <span className="mockup-chip green">Generated</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Billing codes</span>
                  <span className="mockup-chip blue">97110, 97140</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Mobility</span>
                  <span className="mockup-value">+15° since S1</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Next session</span>
                  <span className="mockup-value">March 4</span>
                </div>
              </div>
            </div>
          </div>

          {/* UX Research */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">UX Research</div>
              <h2>
                Your best insights come when you stop taking notes and start
                listening.
              </h2>
              <p>
                Priya runs 45-minute user interviews. The best moments come
                off-script. But she can&apos;t take notes AND be present. After
                each call: 90 minutes reconstructing what was said.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Full interviews captured. Notes auto-generate in your template.
                Cross-interview patterns surface: &quot;5/8 mentioned onboarding
                friction.&quot; PRD input forms auto-populate from findings.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">U7</div>
                  <div>
                    <div className="mockup-name">User #7</div>
                    <div className="mockup-meta">Discovery Interview</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Duration</span>
                  <span className="mockup-value">42 min</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Key insight</span>
                  <span className="mockup-chip blue">Onboarding friction</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Pattern match</span>
                  <span className="mockup-value">5/8 users</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">PRD updated</span>
                  <span className="mockup-chip green">Auto-linked</span>
                </div>
              </div>
            </div>
          </div>

          {/* People Management */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">People Management</div>
              <h2>
                Your engineer mentioned wanting to learn Rust three months ago.
                Do you remember?
              </h2>
              <p>
                Marcus has 8 direct reports. Promo packet time arrives and his
                notes are... sparse. 12 hours to write a packet that still feels
                thin. His director wants a team health report. He has nothing
                but vibes.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Every 1:1 auto-documented. Promo packets write themselves from 6
                months of documented growth. Reports show team patterns: one
                member is 30% slower, so you recommend training.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">AP</div>
                  <div>
                    <div className="mockup-name">Aisha Patel</div>
                    <div className="mockup-meta">Senior Engineer · 12 1:1s</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Growth goals</span>
                  <span className="mockup-chip blue">Rust, Leadership</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Wins logged</span>
                  <span className="mockup-value">8 this quarter</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Promo packet</span>
                  <span className="mockup-chip green">Ready to generate</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Next 1:1</span>
                  <span className="mockup-value">Tomorrow 2pm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Teams */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Product Teams</div>
              <h2>
                Your standup just pushed back the timeline. Does the VP know
                yet?
              </h2>
              <p>
                A blocker surfaces in Tuesday&apos;s standup that pushes the
                launch by two weeks. The VP finds out on Friday. Ravi spends 4
                hours a week writing status updates that are outdated by the
                time he sends them.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Inkra auto-joins standups. PRDs generate from product
                conversations. Timeline changes auto-push to stakeholders. The
                VP knows Tuesday, not Friday.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">PM</div>
                  <div>
                    <div className="mockup-name">Project Alpha</div>
                    <div className="mockup-meta">Sprint 4 · 3 blockers</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Timeline</span>
                  <span className="mockup-chip amber">Shifted +2 wks</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Stakeholders</span>
                  <span className="mockup-chip green">Notified</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">PRD status</span>
                  <span className="mockup-value">Auto-updated</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Next standup</span>
                  <span className="mockup-value">Wed 9:30am</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Support */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Customer Support</div>
              <h2>
                Your support team follows a workflow that changed last week. Do
                they know?
              </h2>
              <p>
                The refund policy changed Tuesday. Three reps gave the old
                policy Wednesday. Training takes weeks to propagate. The best
                rep&apos;s shortcuts live in her head. When she&apos;s out,
                resolution times spike 40%.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Knowledge system updates the moment a policy changes.
                Conversation guides surface the right process during calls. Best
                practices auto-capture from top performers and become team
                playbooks.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">TK</div>
                  <div>
                    <div className="mockup-name">Ticket #4892</div>
                    <div className="mockup-meta">Refund Request · Live</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Policy</span>
                  <span className="mockup-chip green">Updated today</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Suggested response</span>
                  <span className="mockup-chip blue">Ready</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Resolution time</span>
                  <span className="mockup-value">2m 34s</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">CSAT prediction</span>
                  <span className="mockup-value">94%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Legal Services</div>
              <h2>
                Your client mentioned a key detail in the third call. Can you
                find it?
              </h2>
              <p>
                Attorney Kim has 40 active matters. Each client call surfaces
                new facts. She bills 6 hours but spends 2 more on documentation.
                When preparing for trial, she searches through months of
                scattered notes.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Every client conversation indexed and searchable. Matter
                timelines auto-build. Billable time captured accurately. Trial
                prep pulls relevant moments across all calls instantly.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">MK</div>
                  <div>
                    <div className="mockup-name">Matter: Chen v. Apex</div>
                    <div className="mockup-meta">12 calls · Trial in 30d</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Key facts</span>
                  <span className="mockup-value">24 indexed</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Billable captured</span>
                  <span className="mockup-chip green">18.5 hrs</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Timeline</span>
                  <span className="mockup-chip blue">Auto-generated</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Last update</span>
                  <span className="mockup-value">Yesterday</span>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Location Ops */}
          <div className="story reveal">
            <div className="story-content">
              <div className="story-tag">Multi-Location Operations</div>
              <h2>
                Location 7 figured out intake. The other 11 don&apos;t know yet.
              </h2>
              <p>
                Regional director overseeing 12 locations. Best practices
                trapped in one manager&apos;s head. Three weeks just getting
                everyone to submit data in the same format.
              </p>
              <div className="story-with">✓ With Inkra</div>
              <div className="story-benefit">
                Inkra captures how every location operates. Surfaces what works:
                &quot;Location 7&apos;s intake is 40% faster.&quot; Codifies
                best practices into playbooks. Reports auto-generate across all
                locations.
              </div>
            </div>
            <div className="story-visual">
              <div className="story-mockup">
                <div className="mockup-header">
                  <div className="mockup-avatar">RE</div>
                  <div>
                    <div className="mockup-name">Regional Overview</div>
                    <div className="mockup-meta">12 locations · Q1 2026</div>
                  </div>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Top performer</span>
                  <span className="mockup-chip green">Location 7</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Intake speed</span>
                  <span className="mockup-value">40% faster</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Playbook</span>
                  <span className="mockup-chip blue">Published</span>
                </div>
                <div className="mockup-row">
                  <span className="mockup-label">Adoption</span>
                  <span className="mockup-value">8/12 locations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Industries */}
          <div style={{ marginTop: "48px", textAlign: "center" }} className="reveal">
            <p style={{ fontSize: "14px", color: "var(--ink-muted)", marginBottom: "16px" }}>
              If your team runs on conversations, Inkra runs for you.
            </p>
            <div className="industries">
              <span className="ind-chip">Sales</span>
              <span className="ind-chip">Nonprofits</span>
              <span className="ind-chip">Healthcare</span>
              <span className="ind-chip">UX Research</span>
              <span className="ind-chip">People Management</span>
              <span className="ind-chip">Product Teams</span>
              <span className="ind-chip">Customer Support</span>
              <span className="ind-chip">Legal</span>
              <span className="ind-chip">Real Estate</span>
              <span className="ind-chip">Multi-Location Ops</span>
            </div>
          </div>
        </div>
      </section>

      {/* ENGINES */}
      <section className="section" style={{ background: "var(--paper-warm)" }}>
        <div className="section-inner reveal">
          <div className="section-label">The platform</div>
          <div className="section-title">
            Eight engines. One conversation
            <br />
            <em>to power them all.</em>
          </div>
          <div className="engines">
            <div className="engine">
              <div className="engine-icon">📞</div>
              <h4>Conversation Capture</h4>
              <p>
                Calls, meetings, standups, support tickets, plus paper sessions
                via photo upload.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">📄</div>
              <h4>Auto-Documentation</h4>
              <p>
                Notes, case files, SOAP records, intake forms, PRDs:
                generated, not typed.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">💬</div>
              <h4>Conversation Guides</h4>
              <p>
                Real-time prompts, reminders, and key details surfaced during
                live calls.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">📊</div>
              <h4>Reports & Goals</h4>
              <p>
                Grant reports, KPI dashboards, pipeline reviews. Alerts when
                targets are hit.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">🔄</div>
              <h4>Program Tracking</h4>
              <p>
                Multi-session treatments, training programs, client journeys.
                Completion for compliance.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">📚</div>
              <h4>Knowledge System</h4>
              <p>
                Policies, workflows, SOPs captured from practice. Updates push
                org-wide instantly.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">📈</div>
              <h4>Workforce Intelligence</h4>
              <p>
                Team performance visibility without asking. Training recs from
                efficiency data.
              </p>
            </div>
            <div className="engine">
              <div className="engine-icon">📸</div>
              <h4>IRL-to-Digital</h4>
              <p>
                No internet? Print attendance sheets, snap a photo. Everything
                gets logged automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="cta">
        <div className="cta-inner reveal">
          <h2>
            Your conversations should
            <br />
            <em>do the work.</em>
          </h2>
          <p>
            20 founding organizations get priority pricing, white-glove
            onboarding, and direct roadmap input.
          </p>
          {formState.status === "success" || formState.status === "duplicate" ? (
            <div className="wl-confirmation">
              <div className="wl-confirmation-icon">
                {formState.status === "duplicate" ? "!" : "\u2713"}
              </div>
              <div className="wl-confirmation-title">
                {formState.status === "duplicate" ? "You're already on the list!" : "You're on the list!"}
              </div>
              <div className="wl-confirmation-message">
                {formState.status === "duplicate"
                  ? "We already have your application. We'll notify you when your access is ready."
                  : "We'll notify you when your access is ready. Check your inbox for a confirmation email."}
              </div>
            </div>
          ) : (
            <>
              <form className="wl-form" onSubmit={handleFormSubmit}>
                <input type="text" name="firstName" placeholder="First name" required disabled={formState.status === "submitting"} />
                <input type="text" name="lastName" placeholder="Last name" required disabled={formState.status === "submitting"} />
                <input type="email" name="email" placeholder="Work email" required className="full" disabled={formState.status === "submitting"} />
                <input type="text" name="organization" placeholder="Organization" required disabled={formState.status === "submitting"} />
                <select name="role" required defaultValue="" disabled={formState.status === "submitting"}>
                  <option value="" disabled>Your role</option>
                  <option>Sales</option>
                  <option>Account Management</option>
                  <option>Case Manager</option>
                  <option>Social Worker</option>
                  <option>Program Director</option>
                  <option>Executive Director</option>
                  <option>CEO</option>
                  <option>Engineering</option>
                  <option>Product Manager</option>
                  <option>UX Researcher</option>
                  <option>IT</option>
                  <option>Operations</option>
                  <option>Clinician</option>
                  <option>Therapist</option>
                  <option>Doctor</option>
                  <option>Customer Support Lead</option>
                  <option>Other</option>
                </select>
                <select name="teamSize" required className="full" defaultValue="" disabled={formState.status === "submitting"}>
                  <option value="" disabled>Team size</option>
                  <option>1-5</option>
                  <option>6-15</option>
                  <option>16-50</option>
                  <option>51-100</option>
                  <option>100+</option>
                </select>
                <select name="industry" required className="full" defaultValue="" disabled={formState.status === "submitting"}>
                  <option value="" disabled>Industry</option>
                  <option>Sales</option>
                  <option>Tech</option>
                  <option>Nonprofit</option>
                  <option>Human Services</option>
                  <option>Behavioral Health</option>
                  <option>Healthcare</option>
                  <option>Medical</option>
                  <option>UX Research</option>
                  <option>Design</option>
                  <option>Product</option>
                  <option>Engineering</option>
                  <option>Customer Support</option>
                  <option>Legal</option>
                  <option>Real Estate</option>
                  <option>Education</option>
                  <option>Financial Services</option>
                  <option>Government</option>
                  <option>Multi-Location Retail</option>
                  <option>Operations</option>
                  <option>Other</option>
                </select>
                {formState.status === "error" && (
                  <div className="wl-error full">
                    {formState.message}
                  </div>
                )}
                <button
                  type="submit"
                  className="wl-btn"
                  disabled={formState.status === "submitting"}
                >
                  {formState.status === "submitting" ? "Submitting..." : "Apply for the Spring 2026 Pilot"}
                </button>
              </form>
              <div className="cta-note">
                No credit card · Invite-only · One business day response
              </div>
            </>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <MarketingFooter />
    </>
  );
}
