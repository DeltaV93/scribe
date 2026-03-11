"use client";

/**
 * Calendar Provider Button Component
 *
 * Branded button for connecting to a calendar provider (Google, Outlook, Apple).
 * Shows loading state during OAuth flow and disabled state if not configured.
 */

import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProvider = "GOOGLE" | "OUTLOOK" | "APPLE";

interface CalendarProviderButtonProps {
  provider: CalendarProvider;
  configured: boolean;
  loading: boolean;
  onClick: () => void;
}

// Provider-specific configuration
const PROVIDER_CONFIG: Record<
  CalendarProvider,
  {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    hoverColor: string;
    textColor: string;
  }
> = {
  GOOGLE: {
    name: "Google Calendar",
    icon: GoogleCalendarIcon,
    bgColor: "bg-white",
    hoverColor: "hover:bg-gray-50",
    textColor: "text-gray-700",
  },
  OUTLOOK: {
    name: "Outlook Calendar",
    icon: OutlookIcon,
    bgColor: "bg-[#0078D4]",
    hoverColor: "hover:bg-[#106EBE]",
    textColor: "text-white",
  },
  APPLE: {
    name: "Apple Calendar",
    icon: AppleIcon,
    bgColor: "bg-gray-800",
    hoverColor: "hover:bg-gray-900",
    textColor: "text-white",
  },
};

export function CalendarProviderButton({
  provider,
  configured,
  loading,
  onClick,
}: CalendarProviderButtonProps) {
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  return (
    <Button
      variant="outline"
      className={cn(
        "w-full h-12 justify-start gap-3 border",
        config.bgColor,
        config.hoverColor,
        config.textColor,
        !configured && "opacity-50 cursor-not-allowed"
      )}
      disabled={!configured || loading}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="flex-1 text-left">
        {loading ? "Connecting..." : `Connect ${config.name}`}
      </span>
      {!configured && (
        <span className="text-xs opacity-70">Not configured</span>
      )}
    </Button>
  );
}

// Provider Icons
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M18 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6C20 4.9 19.1 4 18 4Z"
        fill="#4285F4"
      />
      <path d="M18 4H12V12H20V6C20 4.9 19.1 4 18 4Z" fill="#EA4335" />
      <path d="M20 12H12V20H18C19.1 20 20 19.1 20 18V12Z" fill="#FBBC05" />
      <path d="M12 12H4V18C4 19.1 4.9 20 6 20H12V12Z" fill="#34A853" />
      <path d="M4 6V12H12V4H6C4.9 4 4 4.9 4 6Z" fill="#4285F4" />
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.55q0-.44.3-.75.3-.3.75-.3h6.52q.11 0 .18.02.08.03.16.07l7.85 4.14q.08.05.14.1.06.06.1.14.05.08.06.17.02.09.02.18v5.73zm-9.38-4.79l-5.14 2.67 5.14 2.67 5.14-2.67-5.14-2.67zm7.38 9.6v-5.64l-5.38 2.87V22H22.2q.17 0 .3-.14.12-.14.12-.31v-.74h-1.24q.38 0 .64-.26.26-.26.26-.64-.01-.38-.27-.64-.26-.26-.63-.26h1.62zM7.88 8h-.73q-.69 0-1.22.35-.52.36-.83.93-.3.57-.4 1.28-.1.7-.1 1.4 0 .7.1 1.37.1.67.4 1.22.31.55.83.89.53.34 1.22.34h.73v1.51h-5.4V8h5.4v-.01z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export { PROVIDER_CONFIG };
