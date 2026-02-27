"use client";

import { useEffect, useState } from "react";
import type { TableOfContentsItem } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

interface TableOfContentsProps {
  items: TableOfContentsItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-100px 0% -80% 0%",
        threshold: 0,
      }
    );

    // Observe all headings
    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      className="sticky top-24 hidden xl:block"
      aria-label="Table of contents"
    >
      <h4 className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-4">
        On this page
      </h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block text-sm transition-colors py-1",
                item.level === 3 && "pl-4",
                activeId === item.id
                  ? "text-ink-blue-accent font-medium"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
