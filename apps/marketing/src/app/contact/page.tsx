import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Mail, Building2, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Inkra team for sales, support, or partnership inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[color-mix(in_srgb,var(--paper)_80%,transparent)] backdrop-blur-md border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/inkra-logo.svg"
              alt="Inkra"
              width={48}
              height={14}
              priority
            />
            <span className="text-lg font-extrabold tracking-tight">Inkra</span>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-4xl mb-4">Get in Touch</h1>
          <p className="text-[var(--ink-muted)] text-lg mb-12">
            Have questions about Inkra? We'd love to hear from you.
          </p>

          <div className="grid gap-6">
            <a
              href="mailto:hello@inkra.ai"
              className="flex items-center gap-4 p-6 border border-[var(--border-light)] rounded-xl hover:border-[var(--ink-blue-accent)] transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center">
                <Mail className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">General Inquiries</h3>
                <p className="text-sm text-[var(--ink-muted)]">hello@inkra.ai</p>
              </div>
            </a>

            <a
              href="mailto:sales@inkra.ai"
              className="flex items-center gap-4 p-6 border border-[var(--border-light)] rounded-xl hover:border-[var(--ink-blue-accent)] transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Sales & Enterprise</h3>
                <p className="text-sm text-[var(--ink-muted)]">sales@inkra.ai</p>
              </div>
            </a>

            <a
              href="mailto:support@inkra.ai"
              className="flex items-center gap-4 p-6 border border-[var(--border-light)] rounded-xl hover:border-[var(--ink-blue-accent)] transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Support</h3>
                <p className="text-sm text-[var(--ink-muted)]">support@inkra.ai</p>
              </div>
            </a>
          </div>

          <div className="mt-12 pt-12 border-t border-[var(--border-light)]">
            <h2 className="font-serif text-2xl mb-4">Ready to get started?</h2>
            <p className="text-[var(--ink-muted)] mb-6">
              Apply for our Spring 2026 pilot program and be among the first to experience Inkra.
            </p>
            <Link
              href="/#cta"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--ink-blue)] text-white font-semibold rounded-xl hover:bg-[var(--ink-blue-mid)] transition-colors"
            >
              Apply for the Pilot
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-[var(--border-light)]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-[var(--ink-faint)]">
            © 2026 Inkra · Phoenixing LLC
          </span>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Privacy</Link>
            <Link href="/terms" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Terms</Link>
            <Link href="/security" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Security</Link>
            <Link href="/contact" className="text-sm text-[var(--ink-blue-accent)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
