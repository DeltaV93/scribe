import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllPosts, formatDate } from "@/lib/blog";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Blog - Inkra Insights",
  description:
    "Insights on conversation intelligence, AI documentation, case management automation, and productivity for nonprofits, healthcare, and sales teams. Learn how to reduce documentation time by 60%.",
  keywords: [
    "conversation intelligence blog",
    "AI documentation insights",
    "nonprofit case management tips",
    "healthcare documentation best practices",
    "sales conversation intelligence",
    "automated documentation",
    "case notes automation",
    "HIPAA compliant documentation",
    "grant reporting automation",
  ],
  openGraph: {
    title: "Blog - Inkra Insights",
    description:
      "Insights on conversation intelligence, AI documentation, and productivity for modern teams.",
    url: "https://inkra.ai/blog",
    siteName: "Inkra",
    type: "website",
    images: [
      {
        url: "/og_imgs/blog.png",
        width: 1200,
        height: 630,
        alt: "Inkra Blog - Conversation Intelligence Insights",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - Inkra Insights",
    description:
      "Insights on conversation intelligence, AI documentation, and productivity.",
    images: ["/og_imgs/blog.png"],
  },
  alternates: {
    canonical: "/blog",
  },
};

function BlogJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Inkra Blog",
    description:
      "Insights on conversation intelligence, AI documentation, and productivity for modern teams.",
    url: "https://inkra.ai/blog",
    publisher: {
      "@type": "Organization",
      name: "Inkra",
      logo: {
        "@type": "ImageObject",
        url: "https://inkra.ai/inkra-logo.svg",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <BlogJsonLd />
      <MarketingNav currentPath="/blog" />
      <main id="main-content" className="min-h-screen bg-paper pt-20">
        {/* Header */}
        <header className="bg-paper-warm border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-20">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink tracking-tight">
              Inkra Insights
            </h1>
            <p className="mt-4 text-lg text-ink-soft max-w-2xl">
              Conversations become work. Here we explore how AI documentation,
              conversation intelligence, and automation transform productivity
              for nonprofits, healthcare, and sales teams.
            </p>
          </div>
        </header>

        {/* Blog posts list */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ink-muted text-lg">
                No posts yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {posts.map((post, index) => (
                <article
                  key={post.slug}
                  className={`group ${
                    index !== 0 ? "border-t border-border pt-12" : ""
                  }`}
                >
                  <Link href={`/blog/${post.slug}`} className="block">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Post image (optional) */}
                      {post.image && (
                        <div className="md:w-1/3 flex-shrink-0">
                          <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-border bg-paper-dim">
                            <Image
                              src={post.image}
                              alt={post.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        </div>
                      )}

                      {/* Post content */}
                      <div className="flex-1">
                        {/* Meta info */}
                        <div className="flex items-center gap-4 text-sm text-ink-muted mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(post.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {post.readingTime}
                          </span>
                        </div>

                        {/* Title */}
                        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-ink group-hover:text-ink-blue-accent transition-colors">
                          {post.title}
                        </h2>

                        {/* Description */}
                        <p className="mt-3 text-ink-soft leading-relaxed line-clamp-3">
                          {post.description}
                        </p>

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs font-medium bg-paper-dim text-ink-muted rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Read more */}
                        <span className="mt-4 inline-flex items-center gap-1 text-ink-blue-accent font-medium group-hover:gap-2 transition-all">
                          Read article
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* CTA Section */}
        <section className="bg-ink-blue text-paper py-20">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="font-serif text-3xl font-semibold mb-4">
              Ready to transform your conversations?
            </h2>
            <p className="text-paper/80 mb-8 max-w-xl mx-auto">
              Join the Spring 2026 pilot program and see how Inkra can reduce
              your documentation time by 60%.
            </p>
            <Link
              href="/#waitlist"
              className="inline-flex items-center gap-2 bg-paper text-ink px-6 py-3 rounded-lg font-medium hover:bg-paper-warm transition-colors"
            >
              Apply for early access
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      {/* Footer */}
      <MarketingFooter />
    </>
  );
}
