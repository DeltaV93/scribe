import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

/**
 * GET /api/ml/health - Check ml-services health status
 */
export async function GET() {
  try {
    // Require authentication to prevent abuse
    await requireAuth();

    // Check both health and readiness
    const [healthResult, readyResult] = await Promise.allSettled([
      mlServices.health.check(),
      mlServices.health.ready(),
    ]);

    const health =
      healthResult.status === "fulfilled"
        ? healthResult.value
        : { status: "unhealthy", error: "Health check failed" };

    const ready =
      readyResult.status === "fulfilled"
        ? readyResult.value
        : { status: "not_ready", db: "unknown", redis: "unknown" };

    const isHealthy =
      healthResult.status === "fulfilled" &&
      readyResult.status === "fulfilled" &&
      health.status === "ok" &&
      ready.status === "ok";

    return NextResponse.json(
      {
        success: true,
        data: {
          healthy: isHealthy,
          status: isHealthy ? "ok" : "degraded",
          services: {
            ml_services: health,
          },
          components: {
            database: "db" in ready ? ready.db : "unknown",
            redis: "redis" in ready ? ready.redis : "unknown",
          },
          timestamp: new Date().toISOString(),
        },
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    console.error("Error checking ml-services health:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        {
          success: false,
          data: {
            healthy: false,
            status: "unhealthy",
            services: {
              ml_services: { status: "unhealthy", error: error.message },
            },
            components: {
              database: "unknown",
              redis: "unknown",
            },
            timestamp: new Date().toISOString(),
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        data: {
          healthy: false,
          status: "unreachable",
          services: {
            ml_services: { status: "unreachable" },
          },
          components: {
            database: "unknown",
            redis: "unknown",
          },
          error: error instanceof Error ? error.message : "Connection failed",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 503 }
    );
  }
}
