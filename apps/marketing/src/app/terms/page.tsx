import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Inkra's terms of service - the rules and guidelines for using our platform.",
};

export default function TermsPage() {
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
        <div className="max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl mb-6">Terms of Service</h1>
          <p className="text-[var(--ink-muted)] mb-8">Last updated: March 2026</p>

          <div className="prose prose-lg">
            <h2 className="font-serif text-2xl mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              By accessing or using Inkra, you agree to be bound by these Terms of Service
              and all applicable laws and regulations.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">2. Description of Service</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              Inkra provides a conversation-to-work platform that converts conversations
              into structured documentation, forms, tasks, and reports.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">3. User Responsibilities</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account,
              complying with applicable laws, and obtaining necessary consents for recording.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">4. Data Ownership</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              You retain ownership of your data. Inkra processes your data solely to provide
              our services. Your data is never used to train AI models.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">5. Limitation of Liability</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              Inkra is provided "as is" without warranties. We are not liable for indirect,
              incidental, or consequential damages arising from your use of the service.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">6. Contact</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              For questions about these terms, contact us at{" "}
              <a href="mailto:legal@inkra.ai" className="text-[var(--ink-blue-accent)]">
                legal@inkra.ai
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-[var(--border-light)]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-[var(--ink-faint)]">
            © 2026 Inkra · Enigma Syndicate LLC
          </span>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Privacy</Link>
            <Link href="/terms" className="text-sm text-[var(--ink-blue-accent)]">Terms</Link>
            <Link href="/security" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Security</Link>
            <Link href="mailto:hello@inkra.ai" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
