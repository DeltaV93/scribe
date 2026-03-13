import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows relative paths starting with /
 */
function validateRedirectUrl(next: string | null): string {
  const defaultPath = "/dashboard";

  if (!next) return defaultPath;

  // Must start with / (relative path)
  if (!next.startsWith('/')) {
    console.warn(`[Security] Blocked redirect to external URL: ${next}`);
    return defaultPath;
  }

  // Block protocol-relative URLs (//evil.com)
  if (next.startsWith('//')) {
    console.warn(`[Security] Blocked protocol-relative redirect: ${next}`);
    return defaultPath;
  }

  // Block javascript: URLs that might be encoded
  if (next.toLowerCase().includes('javascript:')) {
    console.warn(`[Security] Blocked javascript: redirect`);
    return defaultPath;
  }

  // Block data: URLs
  if (next.toLowerCase().includes('data:')) {
    console.warn(`[Security] Blocked data: redirect`);
    return defaultPath;
  }

  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = validateRedirectUrl(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful verification - redirect to next page or dashboard
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
