/**
 * Continue call processing after sensitivity review.
 * PX-878: Tiered Content Classifier
 *
 * This module contains the logic to resume the call processing pipeline
 * from where it left off after sensitivity review is complete.
 */

import { prisma } from "@/lib/db";
import { ProcessingStatus } from "@prisma/client";
import type { TranscriptSegment } from "@/lib/deepgram/transcribe";

/**
 * Continue call processing after sensitivity review.
 *
 * When a call is blocked for sensitivity review, processing stops after
 * the transcription step. This function resumes from that point:
 *
 * 1. Transcript is already saved (from before the block)
 * 2. Continue with ML form matching
 * 3. Continue with field extraction
 * 4. Continue with summary generation
 * 5. Continue with action items and goal drafts
 */
export async function continueCallProcessingAfterReview(
  callId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[ContinueProcessing] Resuming processing for call ${callId}`);

  try {
    // Get call with transcript
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        transcriptRaw: true,
        transcriptJson: true,
        formIds: true,
        durationSeconds: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            orgId: true,
          },
        },
      },
    });

    if (!call) {
      return { success: false, error: "Call not found" };
    }

    if (!call.transcriptRaw || !call.transcriptJson) {
      return { success: false, error: "No transcript available" };
    }

    // Update status to processing
    await prisma.call.update({
      where: { id: callId },
      data: { aiProcessingStatus: ProcessingStatus.PROCESSING },
    });

    const segments = call.transcriptJson as unknown as TranscriptSegment[];

    // Import processing functions dynamically to avoid circular deps
    const {
      detectFormsFromTranscript,
      storeFormMatchingResults,
      auditFormMatching,
      getBestAutoSuggestedForm,
    } = await import("../call-ml-integration");
    const { extractFromCallTranscript } = await import("@/lib/ai/call-extraction");
    const { calculateAllConfidenceScores } = await import("@/lib/ai/confidence");
    const { generateCallSummary } = await import("@/lib/ai/summary");

    // Step 2.5: ML Form Matching (if not already done)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mlMatchedForms: any[] | null | undefined = call.formIds.length > 0 ? null : undefined;

    try {
      console.log(`[ContinueProcessing] Running ML form matching`);
      const mlMatchingResult = await detectFormsFromTranscript(
        call.transcriptRaw,
        call.client.orgId
      );

      if (mlMatchingResult.success) {
        mlMatchedForms = mlMatchingResult.matches;
        await storeFormMatchingResults(callId, mlMatchingResult);
        await auditFormMatching(
          call.client.orgId,
          null,
          callId,
          mlMatchingResult
        );
      }
    } catch (mlError) {
      console.error(`[ContinueProcessing] ML form matching error:`, mlError);
      // Non-critical, continue
    }

    // Step 3: Get form fields for extraction
    const fields = await getFormFieldsForExtraction(call.formIds);

    // Step 4: Extract fields from transcript
    let extractedFields: Record<string, unknown> = {};
    let confidenceScores: Record<string, number> = {};

    if (fields.length > 0) {
      console.log(`[ContinueProcessing] Extracting ${fields.length} fields`);
      const extractionResult = await extractFromCallTranscript(segments, fields);

      for (const field of extractionResult.fields) {
        extractedFields[field.slug] = field.value;
      }

      const fieldTypes: Record<string, string> = {};
      for (const field of fields) {
        fieldTypes[field.slug] = field.type;
      }

      const confidenceBreakdowns = calculateAllConfidenceScores(
        extractionResult.fields,
        segments,
        fieldTypes
      );

      for (const [slug, breakdown] of Object.entries(confidenceBreakdowns)) {
        confidenceScores[slug] = breakdown.overall;
      }
    }

    // Step 5: Generate call summary
    console.log(`[ContinueProcessing] Generating summary`);
    const clientName = `${call.client.firstName} ${call.client.lastName}`;
    const summaryResult = await generateCallSummary(
      segments,
      clientName,
      call.durationSeconds || 0
    );

    // Step 6: Save results
    await prisma.call.update({
      where: { id: callId },
      data: {
        extractedFields: extractedFields as object,
        confidenceScores: confidenceScores as object,
        aiSummary: summaryResult.summary as object,
        aiProcessingStatus: ProcessingStatus.COMPLETED,
        aiProcessingError: null,
      },
    });

    // Step 7: Create action items
    try {
      const { processCallActionItems } = await import("@/lib/ai/call-action-items");
      await processCallActionItems(callId, call.transcriptRaw);
      console.log(`[ContinueProcessing] Created action items for call ${callId}`);
    } catch (error) {
      console.error(`[ContinueProcessing] Failed to create action items:`, error);
    }

    // Step 8: Create goal drafts
    try {
      const { createDraftsFromCall } = await import("../call-goal-drafts");
      const draftResult = await createDraftsFromCall(callId);
      if (draftResult.created > 0) {
        console.log(
          `[ContinueProcessing] Created ${draftResult.created} goal drafts`
        );
      }
    } catch (error) {
      console.error(`[ContinueProcessing] Failed to create goal drafts:`, error);
    }

    console.log(`[ContinueProcessing] Successfully resumed call ${callId}`);
    return { success: true };
  } catch (error) {
    console.error(`[ContinueProcessing] Error resuming call ${callId}:`, error);

    // Update status to failed
    await prisma.call.update({
      where: { id: callId },
      data: {
        aiProcessingStatus: ProcessingStatus.FAILED,
        aiProcessingError:
          error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get form fields for extraction.
 * Copied from call-processing.ts to avoid circular imports.
 */
async function getFormFieldsForExtraction(formIds: string[]) {
  if (formIds.length === 0) return [];

  const forms = await prisma.form.findMany({
    where: { id: { in: formIds } },
    select: {
      fields: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          purpose: true,
          helpText: true,
          isRequired: true,
          options: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  const fields: Array<{
    id: string;
    slug: string;
    name: string;
    type: string;
    purpose: string;
    helpText: string | null;
    isRequired: boolean;
    options: { value: string; label: string }[] | null;
  }> = [];

  for (const form of forms) {
    for (const field of form.fields) {
      fields.push({
        id: field.id,
        slug: field.slug,
        name: field.name,
        type: field.type,
        purpose: field.purpose || "",
        helpText: field.helpText,
        isRequired: field.isRequired,
        options: field.options as { value: string; label: string }[] | null,
      });
    }
  }

  return fields;
}
