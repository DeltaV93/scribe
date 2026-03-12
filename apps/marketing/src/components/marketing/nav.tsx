"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";

const useCases = [
  { name: "Nonprofits", href: "/use-cases/nonprofits" },
  { name: "Healthcare", href: "/use-cases/healthcare" },
  { name: "Sales", href: "/use-cases/sales" },
  { name: "UX Research", href: "/use-cases/ux-research" },
  { name: "Legal", href: "/use-cases/legal" },
];

interface MarketingNavProps {
  currentPath?: string;
}

export function MarketingNav({ currentPath }: MarketingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

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

  const isActive = (href: string) => currentPath === href;
  const isUseCaseActive = useCases.some((uc) => currentPath === uc.href);

  return (
    <>
      <style jsx global>{`
        .marketing-nav {
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
          text-decoration: none;
          color: inherit;
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

        .nav-center {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-link {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
          text-decoration: none;
          transition: color 0.2s var(--ease);
        }

        .nav-link:hover,
        .nav-link.active {
          color: var(--ink-blue-accent);
        }

        .nav-dropdown {
          position: relative;
        }

        .nav-dropdown-trigger {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-muted);
          cursor: pointer;
          transition: color 0.2s var(--ease);
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
        }

        .nav-dropdown-trigger:hover,
        .nav-dropdown-trigger.active {
          color: var(--ink-blue-accent);
        }

        .nav-dropdown-trigger svg {
          transition: transform 0.2s var(--ease);
        }

        .nav-dropdown:hover .nav-dropdown-trigger svg,
        .nav-dropdown-trigger.open svg {
          transform: rotate(180deg);
        }

        .nav-dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--paper);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px;
          min-width: 180px;
          opacity: 0;
          visibility: hidden;
          transform: translateX(-50%) translateY(8px);
          transition: all 0.2s var(--ease);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }

        .nav-dropdown:hover .nav-dropdown-menu {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        .nav-dropdown-link {
          display: block;
          padding: 10px 14px;
          font-size: 14px;
          color: var(--ink-soft);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.15s var(--ease);
        }

        .nav-dropdown-link:hover {
          background: var(--ink-blue-wash);
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

        .nav-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }

        .nav-hamburger span {
          display: block;
          width: 20px;
          height: 2px;
          background: var(--ink);
          border-radius: 1px;
          transition: all 0.2s var(--ease);
        }

        /* Mobile Menu */
        .mobile-menu-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 99;
          opacity: 0;
          transition: opacity 0.3s var(--ease);
        }

        .mobile-menu-overlay.open {
          opacity: 1;
        }

        .mobile-menu {
          display: none;
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(320px, 85vw);
          background: var(--paper);
          z-index: 101;
          padding: 24px;
          transform: translateX(100%);
          transition: transform 0.3s var(--ease);
          overflow-y: auto;
        }

        .mobile-menu.open {
          transform: translateX(0);
        }

        .mobile-menu-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 32px;
        }

        .mobile-menu-close {
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--ink-muted);
        }

        .mobile-menu-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mobile-menu-link {
          font-size: 16px;
          font-weight: 500;
          color: var(--ink-soft);
          text-decoration: none;
          padding: 12px 16px;
          border-radius: 10px;
          transition: all 0.15s var(--ease);
        }

        .mobile-menu-link:hover,
        .mobile-menu-link.active {
          background: var(--ink-blue-wash);
          color: var(--ink-blue-accent);
        }

        .mobile-menu-dropdown {
          border: 1px solid var(--border-light);
          border-radius: 10px;
          overflow: hidden;
        }

        .mobile-menu-dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          font-weight: 500;
          color: var(--ink-soft);
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }

        .mobile-menu-dropdown-trigger svg {
          transition: transform 0.2s var(--ease);
        }

        .mobile-menu-dropdown-trigger.open svg {
          transform: rotate(180deg);
        }

        .mobile-menu-dropdown-trigger.active {
          color: var(--ink-blue-accent);
        }

        .mobile-menu-dropdown-content {
          display: none;
          padding: 0 8px 8px;
        }

        .mobile-menu-dropdown-content.open {
          display: block;
        }

        .mobile-menu-dropdown-link {
          display: block;
          padding: 10px 16px;
          font-size: 14px;
          color: var(--ink-muted);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.15s var(--ease);
        }

        .mobile-menu-dropdown-link:hover {
          background: var(--ink-blue-ghost);
          color: var(--ink-blue-accent);
        }

        .mobile-menu-cta {
          display: block;
          margin-top: 24px;
          padding: 14px;
          background: var(--ink-blue);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          border-radius: 10px;
          transition: all 0.2s var(--ease);
        }

        .mobile-menu-cta:hover {
          background: var(--ink-blue-mid);
        }

        @media (max-width: 768px) {
          .marketing-nav {
            padding: 12px 20px;
          }

          .nav-center {
            display: none;
          }

          .nav-cta {
            display: none;
          }

          .nav-hamburger {
            display: flex;
          }

          .mobile-menu-overlay {
            display: block;
          }

          .mobile-menu {
            display: block;
          }
        }
      `}</style>

      <nav className="marketing-nav">
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
          <Link
            href="/features"
            className={`nav-link ${isActive("/features") ? "active" : ""}`}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={`nav-link ${isActive("/pricing") ? "active" : ""}`}
          >
            Pricing
          </Link>

          <div className="nav-dropdown">
            <button
              className={`nav-dropdown-trigger ${isUseCaseActive ? "active" : ""}`}
            >
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

          <Link
            href="/blog"
            className={`nav-link ${isActive("/blog") ? "active" : ""}`}
          >
            Blog
          </Link>
        </div>

        <Link href="/#cta" className="nav-cta">
          Join the Pilot
        </Link>

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
            className={`mobile-menu-link ${isActive("/features") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className={`mobile-menu-link ${isActive("/pricing") ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>

          <div className="mobile-menu-dropdown">
            <button
              className={`mobile-menu-dropdown-trigger ${useCasesOpen ? "open" : ""} ${isUseCaseActive ? "active" : ""}`}
              onClick={() => setUseCasesOpen(!useCasesOpen)}
            >
              Use Cases
              <ChevronDown className="w-5 h-5" />
            </button>
            <div
              className={`mobile-menu-dropdown-content ${useCasesOpen ? "open" : ""}`}
            >
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
            className={`mobile-menu-link ${isActive("/blog") ? "active" : ""}`}
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
    </>
  );
}
