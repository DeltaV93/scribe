import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getAllPostSlugs, formatDate } from "@/lib/blog";
import { mdxComponents, Callout } from "@/components/blog/mdx-components";
import { ArrowLeft, Clock, Calendar, User, Share2, Twitter, Linkedin } from "lucide-react";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

// Force dynamic rendering to avoid MDX prerender issues
export const dynamic = "force-dynamic";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

// Static params removed - using dynamic rendering instead
// export async function generateStaticParams() {
//   const slugs = getAllPostSlugs();
//   return slugs.map((slug) => ({ slug }));
// }

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author.name],
      images: post.image
        ? [
            {
              url: post.image,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.image ? [post.image] : undefined,
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

function ArticleJsonLd({
  post,
  slug,
}: {
  post: NonNullable<ReturnType<typeof getPostBySlug>>;
  slug: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: post.author.name,
      ...(post.author.role && { jobTitle: post.author.role }),
    },
    publisher: {
      "@type": "Organization",
      name: "Inkra",
      logo: {
        "@type": "ImageObject",
        url: "https://inkra.ai/inkra-logo.svg",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://inkra.ai/blog/${slug}`,
    },
    ...(post.image && {
      image: {
        "@type": "ImageObject",
        url: post.image.startsWith("http")
          ? post.image
          : `https://inkra.ai${post.image}`,
      },
    }),
    ...(post.tags && {
      keywords: post.tags.join(", "),
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function ShareButtons({ title, slug }: { title: string; slug: string }) {
  const url = `https://inkra.ai/blog/${slug}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-4">
      <span className="text-ink-muted text-sm flex items-center gap-2">
        <Share2 className="w-4 h-4" />
        Share
      </span>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-paper-dim transition-colors text-ink-muted hover:text-ink"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-5 h-5" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-paper-dim transition-colors text-ink-muted hover:text-ink"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-5 h-5" />
      </a>
    </div>
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Components including custom ones
  const components = {
    ...mdxComponents,
    Callout,
  };

  return (
    <>
      <ArticleJsonLd post={post} slug={slug} />
      <main id="main-content" className="min-h-screen bg-paper">
        {/* Header with navigation */}
        <header className="bg-paper-warm border-b border-border">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <Link
              href="/blog"
              className="text-ink-blue-accent hover:text-ink-blue transition-colors text-sm font-medium inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              All posts
            </Link>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-12">
          {/* Article header */}
          <header className="mb-12">
            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs font-medium bg-ink-blue-wash text-ink-blue-accent rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-ink tracking-tight leading-tight">
              {post.title}
            </h1>

            {/* Description */}
            <p className="mt-4 text-xl text-ink-soft leading-relaxed">
              {post.description}
            </p>

            {/* Meta */}
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-ink-muted">
              {/* Author */}
              <div className="flex items-center gap-3">
                {post.author.avatar ? (
                  <Image
                    src={post.author.avatar}
                    alt={post.author.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ink-blue-wash flex items-center justify-center">
                    <User className="w-5 h-5 text-ink-blue-accent" />
                  </div>
                )}
                <div>
                  <div className="font-medium text-ink">{post.author.name}</div>
                  {post.author.role && (
                    <div className="text-ink-muted">{post.author.role}</div>
                  )}
                </div>
              </div>

              {/* Date */}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(post.date)}
              </span>

              {/* Reading time */}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readingTime}
              </span>
            </div>

            {/* Share buttons */}
            <div className="mt-6 pt-6 border-t border-border">
              <ShareButtons title={post.title} slug={slug} />
            </div>
          </header>

          {/* Featured image */}
          {post.image && (
            <figure className="mb-12 -mx-6 md:mx-0">
              <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-border">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </figure>
          )}

          {/* Article content */}
          <div className="prose prose-lg max-w-none">
            <MDXRemote
              source={post.content}
              components={components}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  rehypePlugins: [
                    rehypeSlug,
                    [
                      rehypeAutolinkHeadings,
                      {
                        behavior: "wrap",
                        properties: {
                          className: ["anchor"],
                        },
                      },
                    ],
                  ],
                },
              }}
            />
          </div>

          {/* Article footer */}
          <footer className="mt-16 pt-8 border-t border-border">
            {/* Share again */}
            <div className="mb-8">
              <ShareButtons title={post.title} slug={slug} />
            </div>

            {/* Author bio */}
            <div className="p-6 rounded-lg bg-paper-warm border border-border">
              <div className="flex items-start gap-4">
                {post.author.avatar ? (
                  <Image
                    src={post.author.avatar}
                    alt={post.author.name}
                    width={56}
                    height={56}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-ink-blue-wash flex items-center justify-center flex-shrink-0">
                    <User className="w-7 h-7 text-ink-blue-accent" />
                  </div>
                )}
                <div>
                  <div className="font-medium text-ink text-lg">
                    {post.author.name}
                  </div>
                  {post.author.role && (
                    <div className="text-ink-muted">{post.author.role}</div>
                  )}
                  <p className="mt-2 text-ink-soft text-sm">
                    Writing about conversation intelligence, AI documentation,
                    and productivity for modern teams at Inkra.
                  </p>
                </div>
              </div>
            </div>

            {/* Back to blog */}
            <div className="mt-8 text-center">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-ink-blue-accent hover:text-ink-blue transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to all posts
              </Link>
            </div>
          </footer>
        </article>

        {/* CTA Section */}
        <section className="bg-ink-blue text-paper py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
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
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-paper border-t border-border py-8">
          <div className="max-w-3xl mx-auto px-6 text-center text-ink-muted text-sm">
            <p>&copy; {new Date().getFullYear()} Inkra. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
