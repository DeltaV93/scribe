/**
 * Blog post type definitions
 */

export interface BlogPostMeta {
  /** URL-friendly slug derived from filename */
  slug: string;
  /** Post title */
  title: string;
  /** Short description for cards and SEO */
  excerpt: string;
  /** Publication date in ISO format */
  date: string;
  /** Last modified date (optional) */
  lastModified?: string;
  /** Author name */
  author: string;
  /** Author role/title */
  authorRole?: string;
  /** Author avatar URL */
  authorAvatar?: string;
  /** Featured image URL */
  image?: string;
  /** Alt text for featured image */
  imageAlt?: string;
  /** Categories/tags */
  tags: string[];
  /** Reading time in minutes */
  readingTime: number;
  /** Is this post published? */
  published: boolean;
  /** Featured on homepage? */
  featured?: boolean;
}

export interface BlogPost extends BlogPostMeta {
  /** Raw MDX content */
  content: string;
}

export interface TableOfContentsItem {
  /** Heading level (2 or 3) */
  level: number;
  /** Heading text */
  text: string;
  /** URL-friendly ID */
  id: string;
}
