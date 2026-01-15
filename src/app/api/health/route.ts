import { NextResponse } from "next/server";
import { getScannerStatus } from "@/lib/files/scanner";
import { getRAGStatus } from "@/lib/ai/examples";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring services
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "warning" | "error"; details?: string }> = {};
  let overallStatus: "ok" | "warning" | "error" = "ok";

  // Check virus scanner
  try {
    const scannerStatus = await getScannerStatus();
    if (scannerStatus.scanner === "clamav") {
      checks.virusScanner = { status: "ok", details: scannerStatus.details };
    } else if (scannerStatus.scanner === "external-api") {
      checks.virusScanner = { status: "ok", details: "External API" };
    } else {
      checks.virusScanner = {
        status: "warning",
        details: "Using pattern fallback - ClamAV recommended for production"
      };
      overallStatus = "warning";
    }
  } catch (error) {
    checks.virusScanner = {
      status: "error",
      details: error instanceof Error ? error.message : "Unknown error"
    };
    overallStatus = "error";
  }

  // Check RAG/pgvector status
  try {
    const ragStatus = await getRAGStatus();
    if (ragStatus.pgvectorEnabled) {
      const coverage = ragStatus.totalExamples > 0
        ? Math.round((ragStatus.examplesWithEmbeddings / ragStatus.totalExamples) * 100)
        : 100;
      checks.rag = {
        status: coverage >= 80 ? "ok" : "warning",
        details: `pgvector enabled, ${ragStatus.examplesWithEmbeddings}/${ragStatus.totalExamples} examples with embeddings (${coverage}%)`
      };
    } else {
      checks.rag = {
        status: "warning",
        details: "pgvector not enabled - similarity search unavailable"
      };
    }
  } catch (error) {
    checks.rag = {
      status: "warning",
      details: error instanceof Error ? error.message : "RAG check failed"
    };
  }

  // Check database connection
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = { status: "ok" };
  } catch (error) {
    checks.database = {
      status: "error",
      details: error instanceof Error ? error.message : "Database connection failed"
    };
    overallStatus = "error";
  }

  // Check required environment variables
  const requiredEnvVars = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingEnvVars.length > 0) {
    checks.environment = {
      status: "error",
      details: `Missing: ${missingEnvVars.join(", ")}`
    };
    overallStatus = "error";
  } else {
    checks.environment = { status: "ok" };
  }

  // Optional services
  const optionalServices = {
    twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    deepgram: ["DEEPGRAM_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    aws: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"],
    stripe: ["STRIPE_SECRET_KEY"],
  };

  for (const [service, vars] of Object.entries(optionalServices)) {
    const missing = vars.filter(v => !process.env[v]);
    if (missing.length === vars.length) {
      checks[service] = { status: "warning", details: "Not configured" };
    } else if (missing.length > 0) {
      checks[service] = { status: "warning", details: `Missing: ${missing.join(", ")}` };
    } else {
      checks[service] = { status: "ok" };
    }
  }

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}
