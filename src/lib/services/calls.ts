import { prisma } from "@/lib/db";
import { CallStatus, ProcessingStatus } from "@prisma/client";

interface InitiateCallParams {
  clientId: string;
  caseManagerId: string;
  formIds: string[];
  orgId: string;
}

interface UpdateCallParams {
  status?: CallStatus;
  endedAt?: Date;
  durationSeconds?: number;
  twilioCallSid?: string;
  recordingUrl?: string;
  recordingRetention?: Date;
  transcriptRaw?: string;
  transcriptJson?: object;
  aiSummary?: object;
  extractedFields?: object;
  confidenceScores?: object;
  manualCorrections?: object;
  aiProcessingStatus?: ProcessingStatus;
  aiProcessingError?: string;
}

interface ListCallsFilters {
  status?: CallStatus;
  startDate?: Date;
  endDate?: Date;
  caseManagerId?: string;
  clientId?: string;
}

interface Pagination {
  page: number;
  limit: number;
}

/**
 * Initiate a new call
 */
export async function initiateCall(params: InitiateCallParams) {
  const { clientId, caseManagerId, formIds, orgId } = params;

  // Verify client exists and belongs to org
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Create the call record
  const call = await prisma.call.create({
    data: {
      clientId,
      caseManagerId,
      formIds,
      status: CallStatus.INITIATING,
      startedAt: new Date(),
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      caseManager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return call;
}

/**
 * Get a call by ID
 */
export async function getCallById(callId: string, orgId: string) {
  const call = await prisma.call.findFirst({
    where: {
      id: callId,
      client: {
        orgId,
      },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
        },
      },
      caseManager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      formSubmissions: {
        include: {
          form: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return call;
}

/**
 * Update a call
 */
export async function updateCall(callId: string, data: UpdateCallParams) {
  const call = await prisma.call.update({
    where: { id: callId },
    data,
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      caseManager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return call;
}

/**
 * End a call
 */
export async function endCall(callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
  });

  if (!call) {
    throw new Error("Call not found");
  }

  const endedAt = new Date();
  const durationSeconds = Math.floor(
    (endedAt.getTime() - call.startedAt.getTime()) / 1000
  );

  const updatedCall = await prisma.call.update({
    where: { id: callId },
    data: {
      status: CallStatus.COMPLETED,
      endedAt,
      durationSeconds,
      aiProcessingStatus: ProcessingStatus.PENDING,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      caseManager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updatedCall;
}

/**
 * List calls for an organization
 */
export async function listCalls(
  orgId: string,
  filters: ListCallsFilters = {},
  pagination: Pagination = { page: 1, limit: 20 }
) {
  const { status, startDate, endDate, caseManagerId, clientId } = filters;
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    client: {
      orgId,
    },
  };

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) {
      (where.startedAt as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.startedAt as Record<string, Date>).lte = endDate;
    }
  }

  if (caseManagerId) {
    where.caseManagerId = caseManagerId;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startedAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        caseManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.call.count({ where }),
  ]);

  return {
    data: calls,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get calls for a specific case manager
 */
export async function getCaseManagerCalls(
  caseManagerId: string,
  orgId: string,
  filters: Omit<ListCallsFilters, "caseManagerId"> = {},
  pagination: Pagination = { page: 1, limit: 20 }
) {
  return listCalls(orgId, { ...filters, caseManagerId }, pagination);
}

/**
 * Get the active call for a case manager (if any)
 */
export async function getActiveCaseManagerCall(
  caseManagerId: string,
  orgId: string
) {
  const activeStatuses = [
    CallStatus.INITIATING,
    CallStatus.RINGING,
    CallStatus.IN_PROGRESS,
  ];

  const call = await prisma.call.findFirst({
    where: {
      caseManagerId,
      status: { in: activeStatuses },
      client: { orgId },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
  });

  return call;
}

/**
 * Update call status
 */
export async function updateCallStatus(callId: string, status: CallStatus) {
  return updateCall(callId, { status });
}

/**
 * Save call transcript
 */
export async function saveCallTranscript(
  callId: string,
  transcriptRaw: string,
  transcriptJson: object
) {
  return updateCall(callId, { transcriptRaw, transcriptJson });
}

/**
 * Save AI processing results
 */
export async function saveAIProcessingResults(
  callId: string,
  results: {
    aiSummary: object;
    extractedFields: object;
    confidenceScores: object;
  }
) {
  return updateCall(callId, {
    ...results,
    aiProcessingStatus: ProcessingStatus.COMPLETED,
  });
}

/**
 * Mark AI processing as failed
 */
export async function markAIProcessingFailed(
  callId: string,
  error: string,
  retryCount: number
) {
  const status =
    retryCount >= 3
      ? ProcessingStatus.FAILED
      : ProcessingStatus.QUEUED_FOR_RETRY;

  return prisma.call.update({
    where: { id: callId },
    data: {
      aiProcessingStatus: status,
      aiProcessingError: error,
      aiProcessingRetries: retryCount,
    },
  });
}

/**
 * Save recording information
 */
export async function saveRecordingInfo(
  callId: string,
  recordingUrl: string,
  retentionDays: number = 365
) {
  const recordingRetention = new Date();
  recordingRetention.setDate(recordingRetention.getDate() + retentionDays);

  return updateCall(callId, { recordingUrl, recordingRetention });
}

/**
 * Get call transcript
 */
export async function getCallTranscript(callId: string, orgId: string) {
  const call = await prisma.call.findFirst({
    where: {
      id: callId,
      client: { orgId },
    },
    select: {
      id: true,
      transcriptRaw: true,
      transcriptJson: true,
      aiProcessingStatus: true,
    },
  });

  return call;
}

/**
 * Get calls pending AI processing
 */
export async function getCallsPendingProcessing(limit: number = 10) {
  return prisma.call.findMany({
    where: {
      status: CallStatus.COMPLETED,
      aiProcessingStatus: {
        in: [ProcessingStatus.PENDING, ProcessingStatus.QUEUED_FOR_RETRY],
      },
      recordingUrl: { not: null },
    },
    take: limit,
    orderBy: { endedAt: "asc" },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Save manual corrections made during review
 */
export async function saveManualCorrections(
  callId: string,
  corrections: object
) {
  return updateCall(callId, { manualCorrections: corrections });
}

/**
 * Get call statistics for a case manager
 */
export async function getCaseManagerCallStats(
  caseManagerId: string,
  orgId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: Record<string, unknown> = {
    caseManagerId,
    client: { orgId },
  };

  if (startDate || endDate) {
    where.startedAt = {};
    if (startDate) {
      (where.startedAt as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.startedAt as Record<string, Date>).lte = endDate;
    }
  }

  const [total, completed, inProgress, averageDuration] = await Promise.all([
    prisma.call.count({ where }),
    prisma.call.count({
      where: { ...where, status: CallStatus.COMPLETED },
    }),
    prisma.call.count({
      where: {
        ...where,
        status: { in: [CallStatus.INITIATING, CallStatus.RINGING, CallStatus.IN_PROGRESS] },
      },
    }),
    prisma.call.aggregate({
      where: { ...where, status: CallStatus.COMPLETED },
      _avg: { durationSeconds: true },
    }),
  ]);

  return {
    total,
    completed,
    inProgress,
    averageDurationSeconds: averageDuration._avg.durationSeconds || 0,
  };
}
