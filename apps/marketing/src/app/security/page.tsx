import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Shield, Lock, Eye, Server, FileCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Security",
  description: "Inkra's security practices - how we protect your data with enterprise-grade security.",
};

export default function SecurityPage() {
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
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl mb-4">Security at Inkra</h1>
            <p className="text-[var(--ink-muted)] text-lg max-w-2xl mx-auto">
              We protect your data with enterprise-grade security, compliance certifications,
              and a security-first architecture.
            </p>
          </div>

          {/* Security Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">End-to-End Encryption</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                All data is encrypted in transit (TLS 1.3) and at rest (AES-256).
                Your conversations never leave our secure infrastructure unencrypted.
              </p>
            </div>

            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">HIPAA Compliant</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                We sign Business Associate Agreements (BAAs) and implement all required
                safeguards for Protected Health Information (PHI).
              </p>
            </div>

            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">SOC 2 Type II</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                Our infrastructure and processes are audited annually for security,
                availability, and confidentiality controls.
              </p>
            </div>

            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Audit Logging</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                Immutable, hash-chain audit logs track all access to PHI and sensitive data
                for compliance and security monitoring.
              </p>
            </div>

            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Role-Based Access</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                Granular permissions ensure users only access data appropriate to their role.
                SSO/SAML integration available for enterprise.
              </p>
            </div>

            <div className="p-6 border border-[var(--border-light)] rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-[var(--ink-blue-wash)] flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-[var(--ink-blue-accent)]" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Data Residency</h3>
              <p className="text-[var(--ink-muted)] text-sm leading-relaxed">
                Data stored in US-based AWS data centers with options for specific
                regional requirements upon request.
              </p>
            </div>
          </div>

          {/* AI Data Promise */}
          <div className="bg-[var(--ink-blue)] text-white p-8 rounded-2xl text-center mb-16">
            <h2 className="font-serif text-2xl mb-4">Your Data Never Trains Our Models</h2>
            <p className="text-white/70 max-w-xl mx-auto">
              Unlike other AI platforms, your conversations and data are never used to train
              our AI models. Your data is processed solely to deliver our service to you.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center">
            <h2 className="font-serif text-2xl mb-4">Questions about Security?</h2>
            <p className="text-[var(--ink-muted)] mb-6">
              Contact our security team at{" "}
              <a href="mailto:security@inkra.ai" className="text-[var(--ink-blue-accent)]">
                security@inkra.ai
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
            <Link href="/terms" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Terms</Link>
            <Link href="/security" className="text-sm text-[var(--ink-blue-accent)]">Security</Link>
            <Link href="mailto:hello@inkra.ai" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
