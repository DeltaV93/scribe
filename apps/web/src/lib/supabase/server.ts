import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 30 second timeout for VPC/NAT Gateway cold starts
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Fetch wrapper with extended timeout for VPC environments.
 * Uses native AbortSignal.timeout() which is compatible with Supabase SDK.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  return fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, signal])
      : signal,
  });
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
