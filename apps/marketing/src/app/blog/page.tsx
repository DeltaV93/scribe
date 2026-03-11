import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Calendar, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog - Inkra Insights",
  description:
    "Insights on conversation intelligence, AI documentation, case management automation, and productivity for nonprofits, healthcare, and sales teams.",
  openGraph: {
    title: "Blog - Inkra Insights",
    description:
      "Insights on conversation intelligence, AI documentation, and productivity for modern teams.",
    url: "https://oninkra.com/blog",
    siteName: "Inkra",
    type: "website",
  },
  alternates: {
    canonical: "/blog",
  },
};

// Placeholder blog posts - replace with CMS integration later
const posts = [
  {
    slug: "reducing-documentation-time",
    title: "How AI Can Reduce Documentation Time by 60%",
    excerpt: "Learn how conversation intelligence transforms hours of manual note-taking into automated, accurate documentation.",
    date: "2026-03-01",
    readingTime: "5 min read",
    category: "Productivity",
  },
  {
    slug: "hipaa-compliant-ai",
    title: "Building HIPAA-Compliant AI Documentation Systems",
    excerpt: "A deep dive into the security and compliance requirements for AI in healthcare settings.",
    date: "2026-02-15",
    readingTime: "8 min read",
    category: "Compliance",
  },
  {
    slug: "nonprofit-case-management",
    title: "The Future of Nonprofit Case Management",
    excerpt: "How modern nonprofits are leveraging AI to serve more clients without burning out staff.",
    date: "2026-02-01",
    readingTime: "6 min read",
    category: "Nonprofits",
  },
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
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
          <div className="flex items-center gap-6">
            <Link href="/features" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Pricing
            </Link>
            <Link href="/blog" className="text-sm text-[var(--ink-blue-accent)]">
              Blog
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="font-serif text-4xl md:text-5xl mb-4">Inkra Insights</h1>
            <p className="text-[var(--ink-muted)] text-lg max-w-2xl mx-auto">
              Thoughts on conversation intelligence, AI documentation, and building
              tools that help teams focus on what matters.
            </p>
          </div>

          {/* Blog Posts */}
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group p-6 border border-[var(--border-light)] rounded-xl hover:border-[var(--ink-blue-accent)] transition-colors"
              >
                <div className="flex items-center gap-4 text-sm text-[var(--ink-muted)] mb-3">
                  <span className="px-2 py-1 bg-[var(--ink-blue-wash)] text-[var(--ink-blue-accent)] rounded text-xs font-medium">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(post.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.readingTime}
                  </span>
                </div>
                <h2 className="font-serif text-2xl mb-2 group-hover:text-[var(--ink-blue-accent)] transition-colors">
                  {post.title}
                </h2>
                <p className="text-[var(--ink-muted)] mb-4">{post.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-[var(--ink-blue-accent)] text-sm font-medium">
                  Coming soon
                  <ArrowRight className="w-4 h-4" />
                </span>
              </article>
            ))}
          </div>

          {/* Newsletter CTA */}
          <div className="mt-16 p-8 bg-[var(--ink-blue)] text-white rounded-2xl text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <h2 className="font-serif text-2xl mb-2">Stay Updated</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Get the latest insights on AI documentation and conversation intelligence
              delivered to your inbox.
            </p>
            <Link
              href="/#cta"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--ink-blue)] font-semibold rounded-xl hover:bg-white/90 transition-colors"
            >
              Join the Waitlist
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
            <Link href="/contact" className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-blue-accent)]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
