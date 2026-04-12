import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Inkra's privacy policy - how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
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
          <h1 className="font-serif text-4xl mb-6">Privacy Policy</h1>
          <p className="text-[var(--ink-muted)] mb-8">Last updated: March 2026</p>

          <div className="prose prose-lg">
            <h2 className="font-serif text-2xl mt-8 mb-4">1. Information We Collect</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              Inkra collects information you provide directly, such as contact information,
              organization details, and conversation data processed through our platform.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">2. How We Use Your Information</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              We use your information to provide our services, improve our platform,
              communicate with you, and comply with legal obligations.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">3. Data Security</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              We implement industry-standard security measures including encryption,
              access controls, and regular security audits to protect your data.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">4. HIPAA Compliance</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              For healthcare organizations, Inkra operates as a Business Associate under HIPAA
              and implements all required safeguards for Protected Health Information (PHI).
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">5. Your Rights</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              You have the right to access, correct, or delete your personal information.
              Contact us at privacy@inkra.ai to exercise these rights.
            </p>

            <h2 className="font-serif text-2xl mt-8 mb-4">6. Contact Us</h2>
            <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
              For questions about this privacy policy, contact us at{" "}
              <a href="mailto:privacy@inkra.ai" className="text-[var(--ink-blue-accent)]">
                privacy@inkra.ai
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
            <Link href="/privacy" className="text-sm text-[var(--ink-blue-accent)]">Privacy</Link>
            <Link href="/terms" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Terms</Link>
            <Link href="/security" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Security</Link>
            <Link href="mailto:hello@inkra.ai" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
