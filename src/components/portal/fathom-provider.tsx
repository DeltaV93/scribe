"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { FATHOM_SITE_ID, trackPageView, isFathomConfigured } from "@/lib/fathom";

/**
 * Fathom Analytics Provider for Client Portal
 *
 * Loads the Fathom script and tracks page views on route changes.
 * Only renders if NEXT_PUBLIC_FATHOM_SITE_ID is configured.
 */
export function FathomProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    if (!isFathomConfigured()) return;
    trackPageView();
  }, [pathname, searchParams]);

  if (!isFathomConfigured()) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        id="fathom-script"
        src="https://cdn.usefathom.com/script.js"
        data-site={FATHOM_SITE_ID}
        data-spa="auto"
        data-honor-dnt="true"
        defer
      />
      {children}
    </>
  );
}
