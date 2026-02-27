import Link from "next/link";
import Image from "next/image";
import type { BlogPostMeta } from "@/lib/blog/types";
import { formatDate, formatReadingTime } from "@/lib/blog/utils";

interface PostCardProps {
  post: BlogPostMeta;
  /** Show as featured (larger) card */
  featured?: boolean;
}

export function PostCard({ post, featured = false }: PostCardProps) {
  if (featured) {
    return (
      <article className="group">
        <Link
          href={`/blog/${post.slug}`}
          className="grid md:grid-cols-2 gap-8 items-center"
        >
          {/* Image */}
          {post.image && (
            <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-border bg-paper-dim">
              <Image
                src={post.image}
                alt={post.imageAlt || post.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}

          {/* Content */}
          <div>
            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {post.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium text-ink-blue-accent bg-ink-blue-wash px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h2 className="font-serif text-2xl md:text-3xl font-normal text-ink mb-3 group-hover:text-ink-blue-accent transition-colors">
              {post.title}
            </h2>

            {/* Excerpt */}
            <p className="text-ink-muted leading-relaxed mb-4 line-clamp-3">
              {post.excerpt}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-ink-faint">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className="w-1 h-1 rounded-full bg-ink-faint" />
              <span>{formatReadingTime(post.readingTime)}</span>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex flex-col h-full">
      <Link
        href={`/blog/${post.slug}`}
        className="flex flex-col h-full"
      >
        {/* Image */}
        {post.image && (
          <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-border bg-paper-dim mb-4">
            <Image
              src={post.image}
              alt={post.imageAlt || post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium text-ink-blue-accent bg-ink-blue-wash px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="font-serif text-lg font-normal text-ink mb-2 group-hover:text-ink-blue-accent transition-colors line-clamp-2">
          {post.title}
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-ink-muted leading-relaxed mb-4 line-clamp-2 flex-grow">
          {post.excerpt}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-ink-faint mt-auto">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span className="w-1 h-1 rounded-full bg-ink-faint" />
          <span>{formatReadingTime(post.readingTime)}</span>
        </div>
      </Link>
    </article>
  );
}
