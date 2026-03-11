import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/healthz
 *
 * Simple health check endpoint for Railway/load balancer
 * Returns 200 OK if the server is running
 */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
