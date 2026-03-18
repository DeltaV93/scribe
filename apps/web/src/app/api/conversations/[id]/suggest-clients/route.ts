import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import {
  suggestClientsFromTranscript,
  suggestClientsFromPII,
  type ExtractedPII,
} from "@/lib/services/conversation-client-matching";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/conversations/:id/suggest-clients
 *
 * Suggest matching clients based on conversation transcript.
 * Extracts PII from transcript and searches for matching clients.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: conversationId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, conversationId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { minConfidence = 0.70, pii: providedPII } = body as {
      minConfidence?: number;
      pii?: ExtractedPII;
    };

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        transcriptRaw: true,
        clientLinks: {
          select: {
            clientId: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Ensure org matches
    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Already linked clients (to filter out from suggestions)
    const linkedClientIds = new Set(conversation.clientLinks.map((l) => l.clientId));

    let result;

    if (providedPII) {
      // Use provided PII (skip extraction)
      result = await suggestClientsFromPII(user.orgId, providedPII, minConfidence);
    } else {
      // Extract from transcript
      if (!conversation.transcriptRaw) {
        return NextResponse.json(
          { error: { code: "NO_TRANSCRIPT", message: "Conversation has no transcript yet" } },
          { status: 400 }
        );
      }

      result = await suggestClientsFromTranscript(
        user.orgId,
        conversation.transcriptRaw,
        minConfidence
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "EXTRACTION_FAILED", message: result.error || "Failed to extract PII" } },
        { status: 500 }
      );
    }

    // Filter out already-linked clients
    const filteredSuggestions = result.suggestions.filter(
      (s) => !linkedClientIds.has(s.clientId)
    );

    // Audit log for PHI search (using VIEW action since SEARCH isn't a valid action type)
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "VIEW",
      resource: "CLIENT",
      resourceId: conversationId,
      details: {
        operation: "pii_search",
        searchType: "transcript_client_matching",
        conversationId,
        extractedFields: Object.keys(result.extractedPII),
        resultsCount: filteredSuggestions.length,
        minConfidence,
      },
    });

    return NextResponse.json({
      success: true,
      extractedPII: result.extractedPII,
      suggestions: filteredSuggestions,
      tokensUsed: result.tokensUsed,
    });
  } catch (error) {
    console.error("[SuggestClients] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to suggest clients" } },
      { status: 500 }
    );
  }
}
