/**
 * Interaction Metadata Service (PX-735)
 * Handles logging of unrecorded call interactions
 */

import { prisma } from "@/lib/db";
import {
  InteractionType,
  CallDirection,
  UnrecordedReason,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/service";

export interface CreateInteractionMetadataParams {
  clientId: string;
  caseManagerId: string;
  orgId: string;
  interactionType?: InteractionType;
  direction?: CallDirection;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  reason: UnrecordedReason;
  callId?: string;
}

export interface InteractionMetadataResult {
  id: string;
  clientId: string;
  caseManagerId: string;
  interactionType: InteractionType;
  direction: CallDirection;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  reason: UnrecordedReason;
  createdAt: Date;
}

/**
 * Create a new interaction metadata record for an unrecorded call
 */
export async function createInteractionMetadata(
  params: CreateInteractionMetadataParams
): Promise<InteractionMetadataResult> {
  const {
    clientId,
    caseManagerId,
    orgId,
    interactionType = InteractionType.VOIP_CALL,
    direction = CallDirection.OUTBOUND,
    startedAt,
    endedAt,
    durationSeconds,
    reason,
    callId,
  } = params;

  const record = await prisma.interactionMetadata.create({
    data: {
      clientId,
      caseManagerId,
      orgId,
      interactionType,
      direction,
      startedAt,
      endedAt,
      durationSeconds,
      reason,
      callId,
    },
  });

  // Audit log the unrecorded interaction
  await createAuditLog({
    orgId,
    userId: caseManagerId,
    action: "CREATE",
    resource: "CALL",
    resourceId: record.id,
    details: {
      type: "unrecorded_interaction",
      interactionType,
      direction,
      reason,
      clientId,
    },
  });

  return record;
}

/**
 * Get all interaction metadata for a client
 */
export async function getClientInteractionMetadata(
  clientId: string
): Promise<InteractionMetadataResult[]> {
  return prisma.interactionMetadata.findMany({
    where: { clientId },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Get interaction metadata by ID
 */
export async function getInteractionMetadataById(
  id: string
): Promise<InteractionMetadataResult | null> {
  return prisma.interactionMetadata.findUnique({
    where: { id },
  });
}

/**
 * Update interaction metadata when call ends
 */
export async function updateInteractionMetadataOnEnd(
  id: string,
  endedAt: Date,
  durationSeconds: number
): Promise<InteractionMetadataResult> {
  return prisma.interactionMetadata.update({
    where: { id },
    data: {
      endedAt,
      durationSeconds,
    },
  });
}

/**
 * Get count of unrecorded interactions for a client
 */
export async function getUnrecordedInteractionCount(
  clientId: string
): Promise<number> {
  return prisma.interactionMetadata.count({
    where: { clientId },
  });
}

/**
 * Get unrecorded interactions for an organization within a date range
 */
export async function getOrgInteractionMetadata(
  orgId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    reason?: UnrecordedReason;
    limit?: number;
    offset?: number;
  }
): Promise<{
  records: InteractionMetadataResult[];
  total: number;
}> {
  const { startDate, endDate, reason, limit = 50, offset = 0 } = options || {};

  const where = {
    orgId,
    ...(startDate && { startedAt: { gte: startDate } }),
    ...(endDate && { startedAt: { lte: endDate } }),
    ...(reason && { reason }),
  };

  const [records, total] = await Promise.all([
    prisma.interactionMetadata.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.interactionMetadata.count({ where }),
  ]);

  return { records, total };
}
