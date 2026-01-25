import { prisma } from "@/lib/db";
import { getTwilioClient } from "@/lib/twilio/client";
import {
  searchAvailableNumbers,
  searchTollFreeNumbers,
  getUserPhoneNumber,
} from "@/lib/twilio/number-provisioning";

// ============================================
// Types
// ============================================

export interface PhoneNumberStats {
  poolCount: number;
  assignedCount: number;
  totalCount: number;
  poolCost: number;
  assignedCost: number;
  totalMonthlyCost: number;
}

export interface PoolNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
  purchasedAt: Date;
  monthlyCost: number;
}

export interface UserWithPhoneStatus {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phoneNumber: string | null;
  hasPendingRequest: boolean;
  requestId: string | null;
}

// ============================================
// Pricing Configuration
// ============================================

// Twilio costs ~$1.15/month, we charge $5.00/month (77% margin)
export const PHONE_NUMBER_PRICING = {
  monthlyCost: 5.0,
  currency: "USD",
} as const;

const MONTHLY_COST_PER_NUMBER = PHONE_NUMBER_PRICING.monthlyCost;

// ============================================
// Pool Management
// ============================================

/**
 * Get all numbers in the organization's pool (unassigned)
 */
export async function getPoolNumbers(orgId: string): Promise<PoolNumber[]> {
  const numbers = await prisma.phoneNumberPool.findMany({
    where: { orgId },
    orderBy: { purchasedAt: "desc" },
  });

  return numbers.map((n) => ({
    id: n.id,
    phoneNumber: n.phoneNumber,
    areaCode: n.areaCode,
    purchasedAt: n.purchasedAt,
    monthlyCost: Number(n.monthlyCost),
  }));
}

/**
 * Purchase a new phone number and add it to the organization's pool
 */
export async function purchaseNumberToPool(
  orgId: string,
  areaCode?: string
): Promise<PoolNumber> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { preferredAreaCode: true },
  });

  const targetAreaCode = areaCode || org?.preferredAreaCode || "415";

  // Search for available numbers
  let availableNumbers = await searchAvailableNumbers(targetAreaCode, 1);

  if (availableNumbers.length === 0) {
    // Fallback to toll-free numbers
    console.log(`No local numbers available in area code ${targetAreaCode}, trying toll-free...`);
    availableNumbers = await searchTollFreeNumbers(1);
    if (availableNumbers.length === 0) {
      throw new Error("No available phone numbers found. Please try a different area code or contact support.");
    }
  }

  const numberToPurchase = availableNumbers[0].phoneNumber;
  const client = getTwilioClient();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  // Purchase the number from Twilio
  const purchasedNumber = await client.incomingPhoneNumbers.create({
    phoneNumber: numberToPurchase,
    voiceApplicationSid: twimlAppSid,
    friendlyName: `Scrybe Pool - ${orgId}`,
  });

  // Add to pool in database
  const poolNumber = await prisma.phoneNumberPool.create({
    data: {
      orgId,
      phoneNumber: purchasedNumber.phoneNumber,
      twilioSid: purchasedNumber.sid,
      areaCode: targetAreaCode,
      monthlyCost: MONTHLY_COST_PER_NUMBER,
    },
  });

  return {
    id: poolNumber.id,
    phoneNumber: poolNumber.phoneNumber,
    areaCode: poolNumber.areaCode,
    purchasedAt: poolNumber.purchasedAt,
    monthlyCost: Number(poolNumber.monthlyCost),
  };
}

/**
 * Release a number from the pool back to Twilio
 */
export async function releasePoolNumber(poolNumberId: string): Promise<void> {
  const poolNumber = await prisma.phoneNumberPool.findUnique({
    where: { id: poolNumberId },
  });

  if (!poolNumber) {
    throw new Error("Pool number not found");
  }

  const client = getTwilioClient();

  try {
    // Release from Twilio
    await client.incomingPhoneNumbers(poolNumber.twilioSid).remove();

    // Delete from database
    await prisma.phoneNumberPool.delete({
      where: { id: poolNumberId },
    });
  } catch (error) {
    console.error("Error releasing pool number:", error);
    throw new Error("Failed to release phone number");
  }
}

// ============================================
// Assignment Management
// ============================================

/**
 * Assign a number from the pool to a user
 */
export async function assignNumberFromPool(
  userId: string,
  poolNumberId: string
): Promise<{ phoneNumber: string }> {
  // Check if user already has a number
  const existingNumber = await getUserPhoneNumber(userId);
  if (existingNumber) {
    throw new Error("User already has a phone number assigned");
  }

  // Get the pool number
  const poolNumber = await prisma.phoneNumberPool.findUnique({
    where: { id: poolNumberId },
  });

  if (!poolNumber) {
    throw new Error("Pool number not found");
  }

  // Move from pool to user assignment in a transaction
  await prisma.$transaction([
    // Create TwilioNumber for user
    prisma.twilioNumber.create({
      data: {
        userId,
        phoneNumber: poolNumber.phoneNumber,
        twilioSid: poolNumber.twilioSid,
        areaCode: poolNumber.areaCode,
      },
    }),
    // Remove from pool
    prisma.phoneNumberPool.delete({
      where: { id: poolNumberId },
    }),
  ]);

  // Update Twilio friendly name
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(poolNumber.twilioSid).update({
    friendlyName: `Scrybe - User ${userId}`,
  });

  return { phoneNumber: poolNumber.phoneNumber };
}

/**
 * Purchase a new number and assign it directly to a user (on-demand)
 */
export async function purchaseAndAssignNumber(
  userId: string,
  orgId: string,
  areaCode?: string
): Promise<{ phoneNumber: string }> {
  // Check if user already has a number
  const existingNumber = await getUserPhoneNumber(userId);
  if (existingNumber) {
    throw new Error("User already has a phone number assigned");
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { preferredAreaCode: true },
  });

  const targetAreaCode = areaCode || org?.preferredAreaCode || "415";

  // Search for available numbers
  let availableNumbers = await searchAvailableNumbers(targetAreaCode, 1);

  if (availableNumbers.length === 0) {
    availableNumbers = await searchAvailableNumbers("800", 1);
    if (availableNumbers.length === 0) {
      throw new Error("No available phone numbers found");
    }
  }

  const numberToPurchase = availableNumbers[0].phoneNumber;
  const client = getTwilioClient();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  // Purchase the number
  const purchasedNumber = await client.incomingPhoneNumbers.create({
    phoneNumber: numberToPurchase,
    voiceApplicationSid: twimlAppSid,
    friendlyName: `Scrybe - User ${userId}`,
  });

  // Assign directly to user
  await prisma.twilioNumber.create({
    data: {
      userId,
      phoneNumber: purchasedNumber.phoneNumber,
      twilioSid: purchasedNumber.sid,
      areaCode: targetAreaCode,
    },
  });

  return { phoneNumber: purchasedNumber.phoneNumber };
}

/**
 * Unassign a number from a user
 * @param returnToPool - If true, returns to pool instead of releasing to Twilio
 */
export async function unassignNumber(
  userId: string,
  orgId: string,
  returnToPool: boolean = false
): Promise<void> {
  const twilioNumber = await prisma.twilioNumber.findUnique({
    where: { userId },
  });

  if (!twilioNumber) {
    throw new Error("User does not have a phone number assigned");
  }

  if (returnToPool) {
    // Move to pool instead of releasing
    await prisma.$transaction([
      prisma.phoneNumberPool.create({
        data: {
          orgId,
          phoneNumber: twilioNumber.phoneNumber,
          twilioSid: twilioNumber.twilioSid,
          areaCode: twilioNumber.areaCode,
          monthlyCost: MONTHLY_COST_PER_NUMBER,
        },
      }),
      prisma.twilioNumber.delete({
        where: { userId },
      }),
    ]);

    // Update Twilio friendly name
    const client = getTwilioClient();
    await client.incomingPhoneNumbers(twilioNumber.twilioSid).update({
      friendlyName: `Scrybe Pool - ${orgId}`,
    });
  } else {
    // Release to Twilio
    const client = getTwilioClient();
    await client.incomingPhoneNumbers(twilioNumber.twilioSid).remove();
    await prisma.twilioNumber.delete({
      where: { userId },
    });
  }
}

// ============================================
// Statistics & Reporting
// ============================================

/**
 * Get phone number statistics for an organization
 */
export async function getOrganizationPhoneStats(
  orgId: string
): Promise<PhoneNumberStats> {
  // Count pool numbers
  const poolNumbers = await prisma.phoneNumberPool.findMany({
    where: { orgId },
    select: { monthlyCost: true },
  });

  // Count assigned numbers (users in this org with a TwilioNumber)
  const assignedCount = await prisma.twilioNumber.count({
    where: {
      user: { orgId },
    },
  });

  const poolCount = poolNumbers.length;
  const poolCost = poolNumbers.reduce(
    (sum, n) => sum + Number(n.monthlyCost),
    0
  );
  const assignedCost = assignedCount * MONTHLY_COST_PER_NUMBER;

  return {
    poolCount,
    assignedCount,
    totalCount: poolCount + assignedCount,
    poolCost: Math.round(poolCost * 100) / 100,
    assignedCost: Math.round(assignedCost * 100) / 100,
    totalMonthlyCost: Math.round((poolCost + assignedCost) * 100) / 100,
  };
}

/**
 * Get all users in an organization with their phone number status
 */
export async function getUsersWithPhoneStatus(
  orgId: string
): Promise<UserWithPhoneStatus[]> {
  const users = await prisma.user.findMany({
    where: { orgId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      twilioNumber: {
        select: { phoneNumber: true },
      },
      phoneRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phoneNumber: user.twilioNumber?.phoneNumber || null,
    hasPendingRequest: user.phoneRequests.length > 0,
    requestId: user.phoneRequests[0]?.id || null,
  }));
}

/**
 * Get assigned numbers with user details
 */
export async function getAssignedNumbers(orgId: string) {
  const numbers = await prisma.twilioNumber.findMany({
    where: {
      user: { orgId },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { provisionedAt: "desc" },
  });

  return numbers.map((n) => ({
    id: n.id,
    phoneNumber: n.phoneNumber,
    areaCode: n.areaCode,
    provisionedAt: n.provisionedAt,
    userId: n.user.id,
    userName: n.user.name,
    userEmail: n.user.email,
    userRole: n.user.role,
  }));
}
