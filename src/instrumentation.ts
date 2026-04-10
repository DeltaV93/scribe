/**
 * Next.js Instrumentation
 *
 * This file runs before the server starts and configures global settings.
 * Used to set longer connect timeouts for undici (Node.js fetch) in VPC environments.
 */

export async function register() {
  // Only configure on server-side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Agent, setGlobalDispatcher } = await import("undici");

    // Configure undici with longer timeouts for VPC/NAT Gateway environments
    // Default connect timeout is 10s which fails on cold starts
    const agent = new Agent({
      connect: {
        timeout: 60_000, // 60s connect timeout
      },
      bodyTimeout: 60_000, // 60s body timeout
      headersTimeout: 60_000, // 60s headers timeout
    });

    setGlobalDispatcher(agent);

    console.log("[Instrumentation] Configured undici with 60s timeouts");
  }
}
