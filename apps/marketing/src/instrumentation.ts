/**
 * No-op instrumentation for the marketing site.
 *
 * The marketing app is a static export and needs no server-side instrumentation.
 * This file exists to prevent Next.js from resolving the root src/instrumentation.ts
 * (which imports undici, a dependency only available to the web app).
 */
export async function register() {
  // No-op for static marketing site
}
