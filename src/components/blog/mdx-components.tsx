"use client";

import Link from "next/link";
import Image from "next/image";
import type { MDXComponents } from "mdx/types";

/**
 * Custom MDX components for blog posts
 * Styled using Inkra design system (Tiempos headings, Soehne body)
 */
export function useMDXComponents(): MDXComponents {
  return {
    // Headings
    h1: ({ children, ...props }) => (
      <h1
        className="font-serif text-4xl font-normal tracking-tight text-ink mt-12 mb-6 first:mt-0"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, id, ...props }) => (
      <h2
        id={id}
        className="font-serif text-2xl font-normal tracking-tight text-ink mt-10 mb-4 scroll-mt-24"
        {...props}
      >
        <a href={`#${id}`} className="no-underline hover:text-ink-blue-accent">
          {children}
        </a>
      </h2>
    ),
    h3: ({ children, id, ...props }) => (
      <h3
        id={id}
        className="font-serif text-xl font-normal text-ink mt-8 mb-3 scroll-mt-24"
        {...props}
      >
        <a href={`#${id}`} className="no-underline hover:text-ink-blue-accent">
          {children}
        </a>
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4
        className="font-sans text-lg font-medium text-ink mt-6 mb-2"
        {...props}
      >
        {children}
      </h4>
    ),

    // Paragraphs and text
    p: ({ children, ...props }) => (
      <p className="text-ink-soft leading-relaxed mb-6" {...props}>
        {children}
      </p>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-medium text-ink" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),

    // Links
    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith("http");

      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-blue-accent underline underline-offset-2 hover:text-ink-blue-mid transition-colors"
            {...props}
          >
            {children}
          </a>
        );
      }

      return (
        <Link
          href={href || "#"}
          className="text-ink-blue-accent underline underline-offset-2 hover:text-ink-blue-mid transition-colors"
          {...props}
        >
          {children}
        </Link>
      );
    },

    // Lists
    ul: ({ children, ...props }) => (
      <ul
        className="list-disc list-outside pl-6 mb-6 space-y-2 text-ink-soft"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="list-decimal list-outside pl-6 mb-6 space-y-2 text-ink-soft"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-relaxed" {...props}>
        {children}
      </li>
    ),

    // Blockquote
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-ink-blue-accent pl-6 my-8 italic text-ink-muted"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Code
    code: ({ children, ...props }) => (
      <code
        className="bg-paper-dim px-1.5 py-0.5 rounded text-sm font-mono text-ink-soft"
        {...props}
      >
        {children}
      </code>
    ),
    pre: ({ children, ...props }) => (
      <pre
        className="bg-paper-dim border border-border rounded-lg p-4 overflow-x-auto mb-6 text-sm"
        {...props}
      >
        {children}
      </pre>
    ),

    // Horizontal rule
    hr: (props) => (
      <hr className="border-t border-border my-12" {...props} />
    ),

    // Images
    img: ({ src, alt, width: _w, height: _h, ...props }) => {
      if (!src) return null;
      // Omit conflicting spread props that could override width/height
      const { className: _className, ...safeProps } = props as Record<string, unknown>;
      void _className;

      return (
        <figure className="my-8">
          <Image
            src={src}
            alt={alt || ""}
            width={800}
            height={450}
            className="rounded-lg border border-border w-full"
            {...(safeProps as Record<string, never>)}
          />
          {alt && (
            <figcaption className="text-center text-sm text-ink-muted mt-3">
              {alt}
            </figcaption>
          )}
        </figure>
      );
    },

    // Tables
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-8">
        <table className="w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-paper-dim" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border border-border px-4 py-2 text-left font-medium text-ink"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="border border-border px-4 py-2 text-ink-soft"
        {...props}
      >
        {children}
      </td>
    ),
  };
}

// Export components for MDXRemote
export const mdxComponents = useMDXComponents();

/**
 * Callout component for important information
 */
interface CalloutProps {
  type?: "info" | "warning" | "success" | "error";
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  const styles = {
    info: "bg-ink-blue-wash border-ink-blue-accent text-ink",
    warning: "bg-ink-amber-wash border-ink-amber text-ink",
    success: "bg-ink-green-wash border-ink-green text-ink",
    error: "bg-ink-red-wash border-ink-red text-ink",
  };

  const icons = {
    info: "i",
    warning: "!",
    success: "check",
    error: "x",
  };

  return (
    <div
      className={`border-l-4 rounded-r-lg p-4 my-6 ${styles[type]}`}
      role="note"
    >
      {title && (
        <div className="flex items-center gap-2 font-medium mb-2">
          <span className="text-sm">{icons[type]}</span>
          {title}
        </div>
      )}
      <div className="text-ink-soft">{children}</div>
    </div>
  );
}

// Add custom components to MDX
mdxComponents.Callout = Callout;
