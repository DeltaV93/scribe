"use client";

import * as React from "react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import type { MentionUser } from "./extensions/mention";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface MentionListProps {
  items: MentionUser[];
  command: (user: MentionUser) => void;
}

/**
 * Mention autocomplete dropdown component
 *
 * Displays a filtered list of mentionable users when @ is typed.
 * Features:
 * - Keyboard navigation (up/down arrows, enter to select)
 * - Mouse click selection
 * - Visual highlighting of selected item
 * - Accessible with ARIA attributes
 */
export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    const upHandler = () => {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const downHandler = () => {
      setSelectedIndex((prev) => (prev + 1) % items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }

        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }

        if (event.key === "Enter") {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className="z-50 w-64 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md"
          role="listbox"
          aria-label="No users found"
        >
          No users found
        </div>
      );
    }

    return (
      <div
        className="z-50 w-64 overflow-hidden rounded-md border bg-popover shadow-md"
        role="listbox"
        aria-label="Mention suggestions"
        aria-activedescendant={items[selectedIndex]?.id}
      >
        <ul className="max-h-64 overflow-y-auto p-1">
          {items.map((item, index) => (
            <li
              key={item.id}
              id={item.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {/* Avatar */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase"
                aria-hidden="true"
              >
                {item.avatarUrl ? (
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  getInitials(item.name)
                )}
              </div>

              {/* User info */}
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.name}</span>
                {item.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {item.email}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
);

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
