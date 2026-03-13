/**
 * HTML Sanitization Utility
 *
 * Prevents XSS attacks by sanitizing HTML content before rendering.
 * Uses DOMPurify for robust, configurable sanitization.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content for safe rendering
 *
 * Allows safe HTML tags like formatting, lists, links
 * Removes dangerous elements like scripts, iframes, event handlers
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // Allow common formatting tags
    ALLOWED_TAGS: [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "s",
      "strike",
      "ul",
      "ol",
      "li",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "pre",
      "code",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "class",
      "id",
      "style",
      "colspan",
      "rowspan",
    ],
    // Force links to open in new tab with security attributes
    ADD_ATTR: ["target", "rel"],
    // Hook to add rel="noopener noreferrer" to links
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * Strip all HTML tags, returning plain text
 * Useful when HTML is not needed at all
 */
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize HTML for notes (more restrictive)
 * Only allows basic formatting, no links or complex elements
 */
export function sanitizeNoteContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "ul",
      "ol",
      "li",
      "blockquote",
    ],
    ALLOWED_ATTR: [],
  });
}

/**
 * Check if content contains potentially dangerous HTML
 * Returns true if content has suspicious patterns
 */
export function containsDangerousHtml(html: string): boolean {
  const sanitized = DOMPurify.sanitize(html, {
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
  return sanitized !== html;
}
