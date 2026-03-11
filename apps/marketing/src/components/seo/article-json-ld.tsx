/**
 * Article JSON-LD structured data for blog posts
 * Provides rich snippets for search engines and AI agents
 */

import type { BlogPostMeta } from "@/lib/blog/types";

interface ArticleJsonLdProps {
  post: BlogPostMeta;
  url: string;
}

export function ArticleJsonLd({ post, url }: ArticleJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://inkra.ai";

  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: {
      "@type": "Person",
      name: post.author,
      ...(post.authorRole && { jobTitle: post.authorRole }),
    },
    publisher: {
      "@type": "Organization",
      name: "Inkra",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/inkra-logo.svg`,
      },
    },
    datePublished: post.date,
    ...(post.lastModified && { dateModified: post.lastModified }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(post.image && {
      image: {
        "@type": "ImageObject",
        url: post.image.startsWith("http")
          ? post.image
          : `${baseUrl}${post.image}`,
        ...(post.imageAlt && { caption: post.imageAlt }),
      },
    }),
    keywords: post.tags.join(", "),
    wordCount: post.readingTime * 200, // Estimate ~200 words per minute
    articleSection: post.tags[0] || "Technology",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * BreadcrumbList JSON-LD for navigation
 */
interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
