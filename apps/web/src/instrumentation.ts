/**
 * Next.js Instrumentation
 *
 * Configures the global HTTP dispatcher with extended connection timeout
 * for VPC/NAT Gateway environments where cold starts can delay connections.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid bundling issues
    const { Agent, setGlobalDispatcher } = await import("undici");

    // Set global dispatcher with 30s connection timeout
    // This affects all fetch() calls including Supabase
    setGlobalDispatcher(
      new Agent({
        connect: { timeout: 30_000 },
        bodyTimeout: 60_000,
        headersTimeout: 60_000,
      })
    );
  }
}
