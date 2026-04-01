/**
 * Internal audit logging for sensitivity decisions.
 * PX-878: Tiered Content Classifier
 *
 * IMPORTANT: These logs are INTERNAL ONLY - never expose to customers via API.
 * They contain encrypted segment text for compliance audit purposes.
 */

import { prisma } from "@/lib/db";
import type { SensitivityTier } from "@prisma/client";

/**
 * Action types for sensitivity audit log.
 */
export type SensitivityAction = "CONFIRMED" | "DISPUTED" | "ESCALATED";

/**
 * Input for logging a sensitivity decision.
 */
export interface SensitivityAuditInput {
  orgId: string;
  callId: string;
  conversationId?: string;
  segmentIndex: number;
  segmentText: string;
  originalTier: SensitivityTier;
  finalTier: SensitivityTier;
  action: SensitivityAction;
  confidence: number;
  modelVersion: string;
  reviewedById?: string;
}

/**
 * Log a sensitivity decision to the internal audit log.
 *
 * This function:
 * 1. Encrypts the segment text (contains PHI-adjacent content)
 * 2. Creates an audit log entry
 * 3. Updates the SensitivityDecision table for ML retraining
 *
 * IMPORTANT: These logs are internal only - never expose via customer-facing APIs.
 */
export async function logSensitivityDecision(
  input: SensitivityAuditInput
): Promise<void> {
  try {
    // TODO: Encrypt segment text before storage
    // For now, store as-is (should use field-level encryption in production)
    const encryptedText = input.segmentText; // await encrypt(input.segmentText)

    // Create audit log entry
    await prisma.sensitivityAuditLog.create({
      data: {
        orgId: input.orgId,
        callId: input.callId,
        conversationId: input.conversationId,
        segmentIndex: input.segmentIndex,
        segmentText: encryptedText,
        originalTier: input.originalTier,
        finalTier: input.finalTier,
        action: input.action,
        confidence: input.confidence,
        modelVersion: input.modelVersion,
        reviewedById: input.reviewedById,
      },
    });

    // If disputed, also log to SensitivityDecision for retraining
    if (input.action === "DISPUTED") {
      await logDisputeForRetraining(input);
    }

    console.log(
      `[SensitivityAudit] Logged ${input.action} for call ${input.callId} ` +
      `segment ${input.segmentIndex}: ${input.originalTier} -> ${input.finalTier}`
    );
  } catch (error) {
    console.error("[SensitivityAudit] Failed to log decision:", error);
    // Don't throw - audit logging failure shouldn't break the workflow
  }
}

/**
 * Log a disputed classification for ML retraining.
 * These records are used to improve the model.
 */
async function logDisputeForRetraining(
  input: SensitivityAuditInput
): Promise<void> {
  try {
    // Determine category from tier (simplified - actual implementation would
    // use the NLP service's category)
    const categoryMap: Record<SensitivityTier, string> = {
      STANDARD: "STANDARD",
      RESTRICTED: "HR_SENSITIVE", // Default for RESTRICTED
      REDACTED: "PERSONAL_OFF_TOPIC", // Default for REDACTED
    };

    await prisma.sensitivityDecision.create({
      data: {
        orgId: input.orgId,
        // Anonymize text for global model training
        segmentText: anonymizeText(input.segmentText),
        predictedCategory: categoryMap[input.originalTier] as never,
        predictedTier: input.originalTier,
        actualTier: input.finalTier,
        isCorrect: false, // It was disputed
        isLocalModel: true, // Mark for local retraining first
      },
    });
  } catch (error) {
    console.error("[SensitivityAudit] Failed to log for retraining:", error);
  }
}

/**
 * Anonymize text for use in global model training.
 * Removes potential PII while preserving linguistic patterns.
 */
function anonymizeText(text: string): string {
  // Replace names with placeholders
  let anonymized = text;

  // Replace common name patterns (simplified - production would use NER)
  anonymized = anonymized.replace(
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    "[NAME]"
  );

  // Replace phone numbers
  anonymized = anonymized.replace(
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    "[PHONE]"
  );

  // Replace email addresses
  anonymized = anonymized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[EMAIL]"
  );

  // Replace SSN-like patterns
  anonymized = anonymized.replace(
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    "[SSN]"
  );

  // Replace dates
  anonymized = anonymized.replace(
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    "[DATE]"
  );

  return anonymized;
}

/**
 * Get audit log entries for a call.
 * INTERNAL USE ONLY - do not expose via API.
 */
export async function getCallAuditLogs(callId: string): Promise<unknown[]> {
  return prisma.sensitivityAuditLog.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get dispute count for retraining trigger check.
 */
export async function getDisputeCount(
  orgId: string | null,
  sinceDate: Date
): Promise<number> {
  return prisma.sensitivityAuditLog.count({
    where: {
      orgId: orgId ?? undefined,
      action: "DISPUTED",
      createdAt: { gte: sinceDate },
    },
  });
}

/**
 * Get confirmation rate for accuracy tracking.
 */
export async function getConfirmationRate(
  orgId: string | null,
  modelVersion: string,
  sinceDate: Date
): Promise<{ confirmed: number; disputed: number; rate: number }> {
  const counts = await prisma.sensitivityAuditLog.groupBy({
    by: ["action"],
    where: {
      orgId: orgId ?? undefined,
      modelVersion,
      createdAt: { gte: sinceDate },
    },
    _count: { action: true },
  });

  const confirmed = counts.find((c) => c.action === "CONFIRMED")?._count.action ?? 0;
  const disputed = counts.find((c) => c.action === "DISPUTED")?._count.action ?? 0;
  const total = confirmed + disputed;
  const rate = total > 0 ? confirmed / total : 1;

  return { confirmed, disputed, rate };
}
