/**
 * Blog post metadata types for marketing site
 */

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  lastModified?: string;
  author: string;
  authorRole?: string;
  image?: string;
  imageAlt?: string;
  tags: string[];
  readingTime: number;
  featured?: boolean;
}
