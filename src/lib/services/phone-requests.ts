import { prisma } from "@/lib/db";
import { PhoneNumberRequestStatus } from "@prisma/client";
import {
  assignNumberFromPool,
  purchaseAndAssignNumber,
  getPoolNumbers,
} from "./phone-number-management";
import {
  notifyAdminOfPhoneRequest,
  notifyUserOfApproval,
  notifyUserOfRejection,
} from "./email-notifications";

// ============================================
// Types
// ============================================

export interface PhoneRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  status: PhoneNumberRequestStatus;
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolverName: string | null;
  rejectionReason: string | null;
}

// ============================================
// Request Creation
// ============================================

/**
 * Create a phone number request (called by case manager)
 */
export async function createPhoneRequest(
  userId: string,
  orgId: string
): Promise<PhoneRequest> {
  // Check if user already has a number
  const existingNumber = await prisma.twilioNumber.findUnique({
    where: { userId },
  });

  if (existingNumber) {
    throw new Error("You already have a phone number assigned");
  }

  // Check if user already has a pending request
  const existingRequest = await prisma.phoneNumberRequest.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
  });

  if (existingRequest) {
    throw new Error("You already have a pending phone number request");
  }

  // Get user info for notification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Create the request
  const request = await prisma.phoneNumberRequest.create({
    data: {
      userId,
      orgId,
      status: "PENDING",
    },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
    },
  });

  // Notify admins
  await notifyAdminOfPhoneRequest(orgId, user.name || user.email);

  return {
    id: request.id,
    userId: request.userId,
    userName: request.user.name,
    userEmail: request.user.email,
    userRole: request.user.role,
    status: request.status,
    requestedAt: request.requestedAt,
    resolvedAt: request.resolvedAt,
    resolvedBy: request.resolvedBy,
    resolverName: null,
    rejectionReason: request.rejectionReason,
  };
}

// ============================================
// Request Queries
// ============================================

/**
 * Get all pending requests for an organization (admin view)
 */
export async function getPendingRequests(orgId: string): Promise<PhoneRequest[]> {
  const requests = await prisma.phoneNumberRequest.findMany({
    where: {
      orgId,
      status: "PENDING",
    },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
      resolver: {
        select: { name: true },
      },
    },
    orderBy: { requestedAt: "asc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    userEmail: r.user.email,
    userRole: r.user.role,
    status: r.status,
    requestedAt: r.requestedAt,
    resolvedAt: r.resolvedAt,
    resolvedBy: r.resolvedBy,
    resolverName: r.resolver?.name || null,
    rejectionReason: r.rejectionReason,
  }));
}

/**
 * Get all requests for an organization (with filters)
 */
export async function getRequests(
  orgId: string,
  status?: PhoneNumberRequestStatus
): Promise<PhoneRequest[]> {
  const requests = await prisma.phoneNumberRequest.findMany({
    where: {
      orgId,
      ...(status && { status }),
    },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
      resolver: {
        select: { name: true },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    userEmail: r.user.email,
    userRole: r.user.role,
    status: r.status,
    requestedAt: r.requestedAt,
    resolvedAt: r.resolvedAt,
    resolvedBy: r.resolvedBy,
    resolverName: r.resolver?.name || null,
    rejectionReason: r.rejectionReason,
  }));
}

/**
 * Get a user's current pending request (if any)
 */
export async function getUserPendingRequest(userId: string) {
  return prisma.phoneNumberRequest.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
  });
}

/**
 * Count pending requests for an organization (for badge)
 */
export async function countPendingRequests(orgId: string): Promise<number> {
  return prisma.phoneNumberRequest.count({
    where: {
      orgId,
      status: "PENDING",
    },
  });
}

// ============================================
// Request Resolution
// ============================================

/**
 * Approve a phone number request and assign a number
 * @param poolNumberId - If provided, assigns from pool. Otherwise purchases new.
 */
export async function approveRequest(
  requestId: string,
  adminId: string,
  poolNumberId?: string
): Promise<{ phoneNumber: string }> {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: { email: true, orgId: true },
      },
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error("Request has already been resolved");
  }

  let phoneNumber: string;

  if (poolNumberId) {
    // Assign from pool
    const result = await assignNumberFromPool(request.userId, poolNumberId);
    phoneNumber = result.phoneNumber;
  } else {
    // Check if there are pool numbers available
    const poolNumbers = await getPoolNumbers(request.orgId);

    if (poolNumbers.length > 0) {
      // Use first available pool number
      const result = await assignNumberFromPool(request.userId, poolNumbers[0].id);
      phoneNumber = result.phoneNumber;
    } else {
      // Purchase new number
      const result = await purchaseAndAssignNumber(
        request.userId,
        request.orgId
      );
      phoneNumber = result.phoneNumber;
    }
  }

  // Update request status
  await prisma.phoneNumberRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      resolvedAt: new Date(),
      resolvedBy: adminId,
    },
  });

  // Notify user
  await notifyUserOfApproval(request.user.email, phoneNumber);

  return { phoneNumber };
}

/**
 * Reject a phone number request
 */
export async function rejectRequest(
  requestId: string,
  adminId: string,
  reason?: string
): Promise<void> {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error("Request has already been resolved");
  }

  // Update request status
  await prisma.phoneNumberRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      resolvedAt: new Date(),
      resolvedBy: adminId,
      rejectionReason: reason || null,
    },
  });

  // Notify user
  await notifyUserOfRejection(request.user.email, reason);
}

/**
 * Cancel a phone number request (by the requesting user)
 */
export async function cancelRequest(
  requestId: string,
  userId: string
): Promise<void> {
  const request = await prisma.phoneNumberRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.userId !== userId) {
    throw new Error("You can only cancel your own requests");
  }

  if (request.status !== "PENDING") {
    throw new Error("Request has already been resolved");
  }

  await prisma.phoneNumberRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      resolvedAt: new Date(),
    },
  });
}
