"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown } from "lucide-react";

const useCases = [
  { href: "/use-cases/nonprofits", label: "Nonprofits" },
  { href: "/use-cases/healthcare", label: "Healthcare" },
  { href: "/use-cases/sales", label: "Sales" },
  { href: "/use-cases/ux-research", label: "UX Research" },
  { href: "/use-cases/legal", label: "Legal" },
];

interface MarketingNavProps {
  currentPath?: string;
}

export function MarketingNav({ currentPath }: MarketingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);

  const isActive = (path: string) => currentPath === path;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/inkra-logo.svg"
                alt="Inkra"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold text-lg tracking-tight">Inkra</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/features"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>

              {/* Use Cases Dropdown */}
              <div className="relative">
                <button
                  onMouseEnter={() => setUseCasesOpen(true)}
                  onMouseLeave={() => setUseCasesOpen(false)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Use Cases
                  <ChevronDown className="w-4 h-4" />
                </button>
                {useCasesOpen && (
                  <div
                    onMouseEnter={() => setUseCasesOpen(true)}
                    onMouseLeave={() => setUseCasesOpen(false)}
                    className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2"
                  >
                    {useCases.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/blog"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Blog
              </Link>
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/#cta"
                className="text-sm font-semibold px-4 py-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#244280] transition-colors"
              >
                Join the Pilot
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-4 space-y-4">
              <Link
                href="/features"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>

              {/* Use Cases Accordion */}
              <details className="group">
                <summary className="flex items-center justify-between text-gray-600 cursor-pointer">
                  Use Cases
                  <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="mt-2 ml-4 space-y-2">
                  {useCases.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block text-gray-500 hover:text-gray-900"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>

              <Link
                href="/blog"
                className="block text-gray-600 hover:text-gray-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>

              <div className="pt-4 border-t border-gray-100 space-y-3">
                <Link
                  href="/login"
                  className="block text-gray-600 hover:text-gray-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/#cta"
                  className="block text-center font-semibold px-4 py-2 bg-[#1B2A4A] text-white rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Join the Pilot
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer for fixed nav */}
      <div className="h-16" />
    </>
  );
}
