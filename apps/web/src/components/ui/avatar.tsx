"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Generate a consistent color based on a string (user ID or name)
 */
function stringToColor(str: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a name (up to 2 characters)
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export interface AvatarProps {
  name: string | null | undefined;
  /** Used for consistent color generation */
  id?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional image URL */
  src?: string | null;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

export function Avatar({ name, id, size = "sm", src, className }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = stringToColor(id || name || "default");

  if (src) {
    const sizeMap = { sm: 24, md: 32, lg: 40 };
    const pixelSize = sizeMap[size];
    return (
      <Image
        src={src}
        alt={name || "User avatar"}
        width={pixelSize}
        height={pixelSize}
        className={cn(
          "rounded-full object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-medium",
        sizeClasses[size],
        colorClass,
        className
      )}
      title={name || undefined}
    >
      {initials}
    </div>
  );
}
