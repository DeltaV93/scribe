import { ReactNode, ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { MDXComponents } from "mdx/types";

interface CalloutProps {
  type?: "info" | "warning" | "success" | "error";
  title?: string;
  children?: ReactNode;
}

export function Callout({
  type = "info",
  title,
  children,
}: CalloutProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div className={`my-6 p-4 rounded-lg border-l-4 ${styles[type]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-sm">{children}</div>
    </div>
  );
}

// MDX component overrides with proper typing
export const mdxComponents: MDXComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1
      {...props}
      className="text-3xl md:text-4xl font-bold mt-8 mb-4 text-gray-900"
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      {...props}
      className="text-2xl md:text-3xl font-bold mt-8 mb-4 text-gray-900"
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      {...props}
      className="text-xl md:text-2xl font-semibold mt-6 mb-3 text-gray-900"
    />
  ),
  h4: (props: ComponentPropsWithoutRef<"h4">) => (
    <h4
      {...props}
      className="text-lg md:text-xl font-semibold mt-4 mb-2 text-gray-900"
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p {...props} className="my-4 text-gray-700 leading-relaxed" />
  ),
  a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <Link
      href={href || "#"}
      className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
      {...props}
    >
      {children}
    </Link>
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul {...props} className="my-4 pl-6 space-y-2 list-disc text-gray-700" />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      {...props}
      className="my-4 pl-6 space-y-2 list-decimal text-gray-700"
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li {...props} className="leading-relaxed" />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      {...props}
      className="my-6 pl-4 border-l-4 border-gray-200 italic text-gray-600"
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      {...props}
      className="my-4 p-4 rounded-lg bg-gray-900 text-gray-100 overflow-x-auto text-sm"
    />
  ),
  code: ({ className, ...props }: ComponentPropsWithoutRef<"code">) => {
    // If className exists, it's a code block (handled by pre)
    if (className) {
      return <code className={className} {...props} />;
    }
    // Otherwise inline code
    return (
      <code
        {...props}
        className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-sm font-mono"
      />
    );
  },
  img: ({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || ""}
      alt={alt || ""}
      className="my-6 rounded-lg max-w-full"
      {...props}
    />
  ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => (
    <hr {...props} className="my-8 border-gray-200" />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table {...props} className="min-w-full divide-y divide-gray-200" />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      {...props}
      className="px-4 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td {...props} className="px-4 py-3 text-sm text-gray-700" />
  ),
  // Custom components
  Callout,
};
