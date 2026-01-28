"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, GraduationCap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof MessageSquare;
}

export function BottomNav() {
  const pathname = usePathname();
  const params = useParams();
  const token = params.token as string;

  const navItems: NavItem[] = [
    {
      href: `/portal/${token}/messages`,
      label: "Messages",
      icon: MessageSquare,
    },
    {
      href: `/portal/${token}/programs`,
      label: "Programs",
      icon: GraduationCap,
    },
    {
      href: `/portal/${token}/settings`,
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-4 min-h-[56px] min-w-[80px] transition-colors",
                "touch-manipulation", // Better touch handling
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
