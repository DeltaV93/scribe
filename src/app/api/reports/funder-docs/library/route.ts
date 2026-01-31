import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/reports/funder-docs/library - Get curated funder documents
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const funderName = searchParams.get("funderName");
    const documentType = searchParams.get("documentType");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (funderName) {
      where.funderName = { contains: funderName, mode: "insensitive" };
    }
    if (documentType) {
      where.documentType = documentType;
    }

    const [docs, total] = await Promise.all([
      prisma.funderDocumentLibrary.findMany({
        where,
        orderBy: { lastUpdated: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          funderName: true,
          documentType: true,
          lastUpdated: true,
          extractedRequirements: true,
          curatedBy: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.funderDocumentLibrary.count({ where }),
    ]);

    // Get unique funder names for filtering
    const funders = await prisma.funderDocumentLibrary.findMany({
      distinct: ["funderName"],
      select: { funderName: true },
      orderBy: { funderName: "asc" },
    });

    // Get unique document types for filtering
    const types = await prisma.funderDocumentLibrary.findMany({
      distinct: ["documentType"],
      select: { documentType: true },
      orderBy: { documentType: "asc" },
    });

    return NextResponse.json({
      data: {
        documents: docs,
        filters: {
          funders: funders.map((f) => f.funderName),
          documentTypes: types.map((t) => t.documentType),
        },
      },
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing funder documents:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list documents" } },
      { status: 500 }
    );
  }
}
