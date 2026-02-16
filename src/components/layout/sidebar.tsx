"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Phone,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  Menu,
  Shield,
  GraduationCap,
  ListChecks,
  Target,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutAction } from "@/lib/auth/actions";
import { useState, useEffect } from "react";
import type { SessionUser } from "@/types";
import { UserRole } from "@/types";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications";

interface SidebarProps {
  user: SessionUser;
}

// PX-729: Role-based navigation access
// Define which roles can access each nav item
// If allowedRoles is undefined, all roles can access
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: UserRole[];
  excludedRoles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    // All roles can access dashboard
  },
  {
    title: "Forms",
    href: "/forms",
    icon: FileText,
    // Facilitators don't create/manage forms, they focus on programs
    excludedRoles: [UserRole.FACILITATOR],
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    // Facilitators can only see program enrollees, not full client list
    excludedRoles: [UserRole.FACILITATOR],
  },
  {
    title: "Programs",
    href: "/programs",
    icon: GraduationCap,
    // All roles can access programs (facilitators see only their assigned)
  },
  {
    title: "Calls",
    href: "/calls",
    icon: Phone,
    // Facilitators don't have VoIP access
    excludedRoles: [UserRole.FACILITATOR, UserRole.VIEWER],
  },
  {
    title: "Action Items",
    href: "/action-items",
    icon: ListChecks,
    // All roles can access action items
  },
  {
    title: "Goals",
    href: "/goals",
    icon: Target,
    // Facilitators focus on program delivery, not org-wide goals
    excludedRoles: [UserRole.FACILITATOR, UserRole.VIEWER],
  },
  {
    title: "Reminders",
    href: "/reminders",
    icon: Bell,
    // All roles can access reminders
  },
];

const bottomNavItems: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    // All roles can access their settings
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    // Only admins can access billing
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
];

/**
 * Filter nav items based on user role (PX-729)
 */
function filterNavItems(items: NavItem[], userRole: UserRole): NavItem[] {
  return items.filter((item) => {
    // If allowedRoles is defined, user must be in the list
    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
      return false;
    }
    // If excludedRoles is defined, user must NOT be in the list
    if (item.excludedRoles && item.excludedRoles.includes(userRole)) {
      return false;
    }
    return true;
  });
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  // PX-729: Filter navigation items based on user role
  const filteredNavItems = filterNavItems(navItems, user.role as UserRole);
  const filteredBottomNavItems = filterNavItems(bottomNavItems, user.role as UserRole);

  // Fetch pending phone request count for admin badge
  useEffect(() => {
    if (!isAdmin) return;

    const fetchPendingCount = async () => {
      try {
        const response = await fetch("/api/admin/phone-requests");
        if (response.ok) {
          const data = await response.json();
          setPendingRequestCount(data.data?.length || 0);
        }
      } catch (error) {
        console.error("Failed to fetch pending requests:", error);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">
                  S
                </span>
              </div>
              <span className="font-semibold text-xl">Scrybe</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
          >
            {collapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="flex flex-col gap-1 px-2">
            {filteredNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-md mx-auto",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}

            {/* Admin link - only visible to admins */}
            {isAdmin && (
              <>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href="/admin"
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md mx-auto relative",
                          pathname === "/admin" || pathname.startsWith("/admin/")
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Shield className="h-5 w-5" />
                        {pendingRequestCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                            {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Admin {pendingRequestCount > 0 && `(${pendingRequestCount} pending)`}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    href="/admin"
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/admin" || pathname.startsWith("/admin/")
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Shield className="h-5 w-5" />
                    <span className="flex-1">Admin</span>
                    {pendingRequestCount > 0 && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                        {pendingRequestCount}
                      </Badge>
                    )}
                  </Link>
                )}
              </>
            )}

            {/* Notifications with unread badge */}
            <NotificationBell
              collapsed={collapsed}
              className={cn(
                pathname === "/notifications"
                  ? collapsed
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary text-primary-foreground"
                  : ""
              )}
            />
          </nav>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="border-t py-4">
          <nav className="flex flex-col gap-1 px-2">
            {filteredBottomNavItems.map((item) => {
              const isActive = pathname === item.href;

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-md mx-auto",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Section */}
        <div className="border-t p-4">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <form action={signOutAction}>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    className="mx-auto flex"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </form>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user.name?.charAt(0).toUpperCase() ||
                      user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.orgName}
                  </p>
                </div>
              </div>
              <Separator />
              <form action={signOutAction}>
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
