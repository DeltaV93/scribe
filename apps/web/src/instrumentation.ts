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

    // Start BullMQ worker for background job processing
    // Only start if Redis is configured (REDIS_URL env var)
    if (process.env.REDIS_URL) {
      try {
        // Import processors to register them (side-effect imports)
        await import("./lib/jobs/processors");

        // Start the worker
        const { startWorker } = await import("./lib/jobs/worker");
        startWorker();

        console.log("[Instrumentation] BullMQ worker started");
      } catch (error) {
        console.error("[Instrumentation] Failed to start BullMQ worker:", error);
      }
    }
  }
}
