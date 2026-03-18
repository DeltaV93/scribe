/**
 * Multi-Form Extraction Service
 *
 * Extracts data from a conversation transcript for multiple forms in a single
 * Claude API call, then groups results by form.
 */

import { prisma } from "@/lib/db";
import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import type { ExtractableField, FieldExtractionResult } from "@/lib/ai/types";
import type { SpeakerLabel } from "./speaker-labeling";
import type { Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface FormFieldGroup {
  formId: string;
  formName: string;
  formType: string;
  fields: ExtractableField[];
}

export interface FormExtractionResult {
  formId: string;
  formName: string;
  fields: FieldExtractionResult[];
  overallConfidence: number;
}

export interface MultiFormExtractionResult {
  success: boolean;
  forms: FormExtractionResult[];
  tokensUsed: { input: number; output: number };
  processingTimeMs: number;
  error?: string;
}

export interface ExtractionContext {
  speakerLabels?: SpeakerLabel[];
  clientName?: string;
  staffName?: string;
}

// ============================================
// FETCH FORM FIELDS
// ============================================

/**
 * Fetch all fields for the given form IDs
 */
export async function getFormFieldsForExtraction(
  formIds: string[],
  orgId: string
): Promise<FormFieldGroup[]> {
  if (formIds.length === 0) {
    return [];
  }

  const forms = await prisma.form.findMany({
    where: {
      id: { in: formIds },
      orgId,
      status: "PUBLISHED",
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      fields: {
        where: {
          isAiExtractable: true,
        },
        orderBy: { order: "asc" },
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
      },
    },
  });

  return forms.map((form) => ({
    formId: form.id,
    formName: form.name,
    formType: form.type,
    fields: form.fields.map((field) => ({
      id: field.id,
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose,
      helpText: field.helpText,
      isRequired: field.isRequired,
      options: parseOptions(field.options),
    })),
  }));
}

/**
 * Parse field options from JSON
 */
function parseOptions(
  options: unknown
): { value: string; label: string }[] | null {
  if (!options || !Array.isArray(options)) {
    return null;
  }

  return options
    .filter(
      (opt): opt is { value: string; label?: string } =>
        typeof opt === "object" &&
        opt !== null &&
        "value" in opt &&
        typeof opt.value === "string"
    )
    .map((opt) => ({
      value: opt.value,
      label: opt.label || opt.value,
    }));
}

// ============================================
// EXTRACTION PROMPT GENERATION
// ============================================

function generateMultiFormPrompt(
  formGroups: FormFieldGroup[],
  transcript: string,
  context?: ExtractionContext
): string {
  // Build context section
  let contextSection = "";
  if (context?.speakerLabels?.length) {
    const labelDescriptions = context.speakerLabels
      .map((l) => `- ${l.speakerId}: ${l.role}${l.name ? ` (${l.name})` : ""}`)
      .join("\n");
    contextSection = `\nSPEAKER ROLES:\n${labelDescriptions}\n\nFocus on extracting information spoken BY or ABOUT the client(s).\n`;
  }

  // Build form field descriptions
  const formSections = formGroups.map((group) => {
    const fieldDescriptions = group.fields
      .map((field) => {
        let desc = `  - ${field.slug} (${field.name}): ${field.purpose}`;
        if (field.type === "DROPDOWN" || field.type === "CHECKBOX") {
          const opts = field.options?.map((o) => o.value).join(", ");
          if (opts) {
            desc += ` [Options: ${opts}]`;
          }
        }
        if (field.isRequired) {
          desc += " [REQUIRED]";
        }
        return desc;
      })
      .join("\n");

    return `FORM: ${group.formName} (ID: ${group.formId}, Type: ${group.formType})\nFields:\n${fieldDescriptions}`;
  });

  return `You are extracting structured data from a conversation transcript into multiple forms.
${contextSection}
FORMS TO EXTRACT:
${formSections.join("\n\n")}

TRANSCRIPT:
${transcript.slice(0, 12000)}

INSTRUCTIONS:
1. Extract values for each field from the transcript
2. Only extract information that is explicitly stated
3. Do not infer or guess values
4. For dropdown/checkbox fields, only use the provided options
5. Include a source snippet showing where you found each value
6. Rate your confidence (0-100) for each extraction
7. Mark needsReview=true if confidence < 70 or value seems uncertain

Respond with a JSON object in this exact format:
{
  "forms": [
    {
      "formId": "form-id-here",
      "extractions": [
        {
          "fieldId": "field-id",
          "slug": "field-slug",
          "value": "extracted value or null if not found",
          "confidence": 85,
          "reasoning": "Brief explanation",
          "sourceSnippet": "Relevant quote from transcript",
          "needsReview": false
        }
      ],
      "overallConfidence": 80
    }
  ]
}

Only include fields where you found relevant information. Omit fields with no data found.`;
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract data from transcript for multiple forms
 */
export async function extractMultiFormData(
  formGroups: FormFieldGroup[],
  transcript: string,
  context?: ExtractionContext
): Promise<MultiFormExtractionResult> {
  const startTime = Date.now();

  // Check if there are any fields to extract
  const totalFields = formGroups.reduce((sum, g) => sum + g.fields.length, 0);
  if (totalFields === 0) {
    return {
      success: true,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
    };
  }

  try {
    const prompt = generateMultiFormPrompt(formGroups, transcript, context);

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 8192,
      system: `You are a data extraction specialist. Extract structured information from conversation transcripts accurately and conservatively. When uncertain, indicate low confidence rather than guessing.`,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      forms: Array<{
        formId: string;
        extractions: FieldExtractionResult[];
        overallConfidence: number;
      }>;
    };

    // Map results back to form names and validate
    const formResults: FormExtractionResult[] = parsed.forms.map((formResult) => {
      const formGroup = formGroups.find((g) => g.formId === formResult.formId);

      return {
        formId: formResult.formId,
        formName: formGroup?.formName || "Unknown Form",
        fields: formResult.extractions.map((extraction) => ({
          fieldId: extraction.fieldId,
          slug: extraction.slug,
          value: extraction.value,
          confidence: Math.min(100, Math.max(0, extraction.confidence)),
          reasoning: extraction.reasoning,
          sourceSnippet: extraction.sourceSnippet,
          needsReview: extraction.needsReview || extraction.confidence < 70,
        })),
        overallConfidence: formResult.overallConfidence,
      };
    });

    return {
      success: true,
      forms: formResults,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[MultiFormExtraction] Error:", error);
    return {
      success: false,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Extraction failed",
    };
  }
}

// ============================================
// STORE EXTRACTION RESULTS
// ============================================

export interface StoredExtractionData {
  forms: {
    [formId: string]: {
      formName: string;
      fields: {
        [slug: string]: {
          fieldId: string;
          value: unknown;
          confidence: number;
          reasoning?: string;
          sourceSnippet?: string;
          needsReview: boolean;
        };
      };
    };
  };
  extractedAt: string;
  tokensUsed: { input: number; output: number };
}

/**
 * Store extraction results in the conversation
 */
export async function storeExtractionResults(
  conversationId: string,
  results: MultiFormExtractionResult
): Promise<void> {
  // Convert to storage format
  const extractedFields: StoredExtractionData["forms"] = {};
  const confidenceScores: Record<string, Record<string, number>> = {};

  for (const formResult of results.forms) {
    extractedFields[formResult.formId] = {
      formName: formResult.formName,
      fields: {},
    };
    confidenceScores[formResult.formId] = {};

    for (const field of formResult.fields) {
      extractedFields[formResult.formId].fields[field.slug] = {
        fieldId: field.fieldId,
        value: field.value,
        confidence: field.confidence,
        reasoning: field.reasoning,
        sourceSnippet: field.sourceSnippet,
        needsReview: field.needsReview,
      };
      confidenceScores[formResult.formId][field.slug] = field.confidence;
    }
  }

  // Update conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      extractedFields: {
        forms: extractedFields,
        extractedAt: new Date().toISOString(),
        tokensUsed: results.tokensUsed,
      } as Prisma.InputJsonValue,
      confidenceScores: confidenceScores as Prisma.InputJsonValue,
    },
  });
}

// ============================================
// FULL EXTRACTION PIPELINE
// ============================================

/**
 * Run complete multi-form extraction for a conversation
 */
export async function runMultiFormExtraction(
  conversationId: string,
  options?: {
    speakerLabels?: SpeakerLabel[];
  }
): Promise<MultiFormExtractionResult> {
  // Get conversation with transcript and form IDs
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      orgId: true,
      transcriptRaw: true,
      formIds: true,
      inPersonDetails: {
        select: {
          participants: true,
        },
      },
    },
  });

  if (!conversation) {
    return {
      success: false,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
      error: "Conversation not found",
    };
  }

  if (!conversation.transcriptRaw) {
    return {
      success: false,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
      error: "No transcript available",
    };
  }

  if (conversation.formIds.length === 0) {
    return {
      success: false,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
      error: "No forms linked to conversation",
    };
  }

  // Get form fields
  const formGroups = await getFormFieldsForExtraction(
    conversation.formIds,
    conversation.orgId
  );

  if (formGroups.length === 0) {
    return {
      success: false,
      forms: [],
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
      error: "No extractable fields found in linked forms",
    };
  }

  // Build context from speaker labels
  let speakerLabels = options?.speakerLabels;
  if (!speakerLabels && conversation.inPersonDetails?.participants) {
    const participants = conversation.inPersonDetails.participants;
    if (Array.isArray(participants)) {
      speakerLabels = participants
        .filter(
          (p): p is { speakerId: string; role?: string; name?: string } =>
            typeof p === "object" &&
            p !== null &&
            "speakerId" in p &&
            typeof (p as { speakerId?: unknown }).speakerId === "string"
        )
        .map((p) => ({
          speakerId: p.speakerId,
          role: (p.role as SpeakerLabel["role"]) || "other",
          name: p.name,
        }));
    }
  }

  const context: ExtractionContext = {};
  if (speakerLabels?.length) {
    context.speakerLabels = speakerLabels;
  }

  // Run extraction
  const results = await extractMultiFormData(
    formGroups,
    conversation.transcriptRaw,
    context
  );

  // Store results if successful
  if (results.success) {
    await storeExtractionResults(conversationId, results);
  }

  return results;
}
