import { isRedirectError } from "next/dist/client/components/redirect-error";
import { NextResponse } from "next/server";

/**
 * Handle API errors, re-throwing redirect errors so Next.js can process them.
 * Use in catch blocks of API route handlers.
 *
 * In Next.js App Router, redirect() works by throwing a special NEXT_REDIRECT error.
 * If this error is caught and not re-thrown, the redirect won't happen.
 *
 * @example
 * ```ts
 * export async function GET() {
 *   try {
 *     const user = await requireAuth();
 *     // ... handler logic
 *   } catch (error) {
 *     return handleApiError(error, "Failed to process request");
 *   }
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  message: string,
  context?: string
): NextResponse {
  // Re-throw redirect errors so Next.js handles them (e.g., MFA setup redirect)
  if (isRedirectError(error)) {
    throw error;
  }

  console.error(context ? `${context}: ${message}:` : `${message}:`, error);

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message } },
    { status: 500 }
  );
}
