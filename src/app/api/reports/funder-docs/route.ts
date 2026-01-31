import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// Validation schema for uploading funder docs
const uploadFunderDocSchema = z.object({
  name: z.string().min(1).max(200),
  funderName: z.string().min(1).max(200),
  documentType: z.string().min(1).max(100),
  extractedText: z.string().min(1),
  sourcePath: z.string().min(1),
});

/**
 * POST /api/reports/funder-docs - Upload and process a funder document
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can upload funder docs
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only admins can upload funder documents" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = uploadFunderDocSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { name, funderName, documentType, extractedText, sourcePath } = validation.data;

    // Use AI to extract requirements from the document
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyze the following funder document and extract the reporting requirements. Return a JSON object with:
- requiredMetrics: array of required metric names/descriptions
- requiredSections: array of required report sections
- deadlines: any mentioned deadlines
- formatRequirements: any format or structure requirements
- dataElements: specific data elements that must be reported
- notes: any other important requirements

Document text:
${extractedText.slice(0, 10000)}

Respond ONLY with valid JSON.`,
        },
      ],
    });

    let extractedRequirements = {};
    const content = response.content[0];
    if (content.type === "text") {
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedRequirements = JSON.parse(jsonMatch[0]);
        }
      } catch {
        extractedRequirements = { rawAnalysis: content.text };
      }
    }

    // Store the document
    const doc = await prisma.funderDocumentLibrary.create({
      data: {
        name,
        funderName,
        documentType,
        sourcePath,
        extractedText,
        extractedRequirements: extractedRequirements as unknown as Prisma.InputJsonValue,
        lastUpdated: new Date(),
        curatedById: user.id,
      },
    });

    return NextResponse.json(
      { data: doc },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading funder document:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upload document" } },
      { status: 500 }
    );
  }
}
