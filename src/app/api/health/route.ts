import { NextResponse } from "next/server";
import { getScannerStatus } from "@/lib/files/scanner";
import { getRAGStatus } from "@/lib/ai/examples";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ServiceStatus = "healthy" | "degraded" | "unhealthy";

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latency?: number;
  details?: string;
}

interface PublicHealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
}

interface AdminHealthResponse extends PublicHealthResponse {
  services: ServiceCheck[];
}

/**
 * Measure latency of an async operation in milliseconds
 */
async function measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; latency: number }> {
  const start = performance.now();
  const result = await operation();
  const latency = Math.round(performance.now() - start);
  return { result, latency };
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring services.
 *
 * Public access: Returns only overall status and timestamp.
 * Admin access: Returns full service details including latency and configuration status.
 */
export async function GET(): Promise<NextResponse<PublicHealthResponse | AdminHealthResponse>> {
  const timestamp = new Date().toISOString();
  const services: ServiceCheck[] = [];
  let overallStatus: "healthy" | "degraded" = "healthy";

  // Check if user is authenticated admin
  const user = await getCurrentUser();
  const isAdminUser = user && isAdmin(user);

  // Check database connection with latency measurement
  try {
    const { latency } = await measureLatency(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    services.push({
      name: "database",
      status: "healthy",
      latency,
    });
  } catch {
    services.push({
      name: "database",
      status: "unhealthy",
      details: isAdminUser ? "Connection failed" : undefined,
    });
    overallStatus = "degraded";
  }

  // Check virus scanner
  try {
    const { result: scannerStatus, latency } = await measureLatency(() => getScannerStatus());
    if (scannerStatus.scanner === "clamav" || scannerStatus.scanner === "external-api") {
      services.push({
        name: "virusScanner",
        status: "healthy",
        latency,
      });
    } else {
      services.push({
        name: "virusScanner",
        status: "degraded",
        latency,
        details: isAdminUser ? "Using pattern fallback" : undefined,
      });
      overallStatus = "degraded";
    }
  } catch {
    services.push({
      name: "virusScanner",
      status: "unhealthy",
    });
    overallStatus = "degraded";
  }

  // Check RAG/pgvector status
  try {
    const { result: ragStatus, latency } = await measureLatency(() => getRAGStatus());
    if (ragStatus.pgvectorEnabled) {
      const coverage = ragStatus.totalExamples > 0
        ? Math.round((ragStatus.examplesWithEmbeddings / ragStatus.totalExamples) * 100)
        : 100;
      services.push({
        name: "rag",
        status: coverage >= 80 ? "healthy" : "degraded",
        latency,
        details: isAdminUser ? `${coverage}% embeddings coverage` : undefined,
      });
      if (coverage < 80) {
        overallStatus = "degraded";
      }
    } else {
      services.push({
        name: "rag",
        status: "degraded",
        latency,
        details: isAdminUser ? "pgvector not enabled" : undefined,
      });
      overallStatus = "degraded";
    }
  } catch {
    services.push({
      name: "rag",
      status: "degraded",
    });
  }

  // Check required configuration (no env var names exposed)
  const requiredEnvVars = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missingRequired = requiredEnvVars.filter(v => !process.env[v]).length;

  if (missingRequired > 0) {
    services.push({
      name: "configuration",
      status: "unhealthy",
      details: isAdminUser ? `${missingRequired} required settings missing` : undefined,
    });
    overallStatus = "degraded";
  } else {
    services.push({
      name: "configuration",
      status: "healthy",
    });
  }

  // Check optional services configuration (admin only sees details)
  const optionalServices = {
    twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    deepgram: ["DEEPGRAM_API_KEY"],
    storage: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"],
    billing: ["STRIPE_SECRET_KEY"],
  };

  for (const [serviceName, vars] of Object.entries(optionalServices)) {
    const configuredCount = vars.filter(v => process.env[v]).length;
    const isFullyConfigured = configuredCount === vars.length;
    const isPartiallyConfigured = configuredCount > 0 && configuredCount < vars.length;

    if (isFullyConfigured) {
      services.push({
        name: serviceName,
        status: "healthy",
      });
    } else if (isPartiallyConfigured) {
      services.push({
        name: serviceName,
        status: "degraded",
        details: isAdminUser ? "Partially configured" : undefined,
      });
    } else {
      services.push({
        name: serviceName,
        status: "degraded",
        details: isAdminUser ? "Not configured" : undefined,
      });
    }
  }

  // Return public response for unauthenticated or non-admin users
  if (!isAdminUser) {
    const publicResponse: PublicHealthResponse = {
      status: overallStatus,
      timestamp,
    };
    return NextResponse.json(publicResponse);
  }

  // Return full response for admin users
  const adminResponse: AdminHealthResponse = {
    status: overallStatus,
    timestamp,
    services,
  };
  return NextResponse.json(adminResponse);
}
