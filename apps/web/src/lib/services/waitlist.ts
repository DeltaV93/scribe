import { prisma } from "@/lib/db";
import { WaitlistStatus } from "@prisma/client";
import crypto from "crypto";
import {
  sendWaitlistConfirmationEmail,
  sendWaitlistApprovalEmail,
} from "./email-notifications";

// ============================================
// Types
// ============================================

export interface CreateWaitlistInput {
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  teamSize: string;
  industry: string;
  referralSource?: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  teamSize: string;
  industry: string;
  status: WaitlistStatus;
  submittedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  approvedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface WaitlistCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
}

export interface ListWaitlistResult {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  totalPages: number;
  counts: WaitlistCounts;
}

// ============================================
// Constants
// ============================================

const TOKEN_EXPIRY_DAYS = 7;

// Demo account emails from environment variable
export function getDemoAccountEmails(): string[] {
  const envVar = process.env.DEMO_ACCOUNT_EMAILS || "";
  return envVar
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Check if an email is a demo account that bypasses waitlist
 */
export function isDemoAccount(email: string): boolean {
  const demoEmails = getDemoAccountEmails();
  return demoEmails.includes(email.toLowerCase());
}

// Internal admin emails from environment variable
export function getInternalAdminEmails(): string[] {
  const envVar = process.env.INTERNAL_ADMIN_EMAILS || "";
  return envVar
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Check if an email is an internal admin who can manage the waitlist
 */
export function isInternalAdmin(email: string): boolean {
  const internalEmails = getInternalAdminEmails();
  return internalEmails.includes(email.toLowerCase());
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate a secure random token for approval links
 */
function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate token expiration date (7 days from now)
 */
function getTokenExpirationDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + TOKEN_EXPIRY_DAYS);
  return date;
}

// ============================================
// Waitlist Service
// ============================================

/**
 * Submit a new waitlist entry
 */
export async function submitToWaitlist(
  input: CreateWaitlistInput
): Promise<{ entry: WaitlistEntry; isNew: boolean }> {
  const email = input.email.toLowerCase();

  // Check for existing entry
  const existing = await prisma.waitlist.findUnique({
    where: { email },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (existing) {
    return {
      entry: existing as WaitlistEntry,
      isNew: false,
    };
  }

  // Create new entry
  const entry = await prisma.waitlist.create({
    data: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      organization: input.organization,
      role: input.role,
      teamSize: input.teamSize,
      industry: input.industry,
      referralSource: input.referralSource || null,
      status: WaitlistStatus.PENDING,
    },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Send confirmation email (fire and forget)
  sendWaitlistConfirmationEmail(email, {
    firstName: input.firstName,
    organization: input.organization,
    role: input.role,
    teamSize: input.teamSize,
    industry: input.industry,
  }).catch((err) => {
    console.error("Failed to send waitlist confirmation email:", err);
  });

  return {
    entry: entry as WaitlistEntry,
    isNew: true,
  };
}

/**
 * Get waitlist entry by email
 */
export async function getWaitlistByEmail(
  email: string
): Promise<WaitlistEntry | null> {
  const entry = await prisma.waitlist.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return entry as WaitlistEntry | null;
}

/**
 * List waitlist entries with filtering and pagination
 */
export async function listWaitlist(options: {
  status?: WaitlistStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ListWaitlistResult> {
  const { status, search, page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { organization: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get entries
  const [entries, total] = await Promise.all([
    prisma.waitlist.findMany({
      where,
      include: {
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { submittedAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.waitlist.count({ where }),
  ]);

  // Get counts by status
  const [pending, approved, rejected, completed] = await Promise.all([
    prisma.waitlist.count({ where: { status: WaitlistStatus.PENDING } }),
    prisma.waitlist.count({ where: { status: WaitlistStatus.APPROVED } }),
    prisma.waitlist.count({ where: { status: WaitlistStatus.REJECTED } }),
    prisma.waitlist.count({ where: { status: WaitlistStatus.COMPLETED } }),
  ]);

  return {
    entries: entries as WaitlistEntry[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    counts: {
      total: pending + approved + rejected + completed,
      pending,
      approved,
      rejected,
      completed,
    },
  };
}

/**
 * Approve a waitlist entry
 */
export async function approveWaitlistEntry(
  id: string,
  approvedById: string
): Promise<WaitlistEntry> {
  const token = generateApprovalToken();
  const expiresAt = getTokenExpirationDate();

  const entry = await prisma.waitlist.update({
    where: { id },
    data: {
      status: WaitlistStatus.APPROVED,
      approvalToken: token,
      tokenExpiresAt: expiresAt,
      approvedAt: new Date(),
      approvedById,
    },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Send approval email
  const accountCreationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/signup/waitlist/${token}`;

  sendWaitlistApprovalEmail(entry.email, {
    firstName: entry.firstName,
    accountCreationUrl,
  }).catch((err) => {
    console.error("Failed to send waitlist approval email:", err);
  });

  return entry as WaitlistEntry;
}

/**
 * Reject a waitlist entry (silent - no email)
 */
export async function rejectWaitlistEntry(id: string): Promise<WaitlistEntry> {
  const entry = await prisma.waitlist.update({
    where: { id },
    data: {
      status: WaitlistStatus.REJECTED,
    },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return entry as WaitlistEntry;
}

/**
 * Batch approve next N pending entries in FIFO order
 */
export async function batchApproveWaitlist(
  count: number,
  approvedById: string
): Promise<WaitlistEntry[]> {
  // Get next N pending entries in submission order
  const pendingEntries = await prisma.waitlist.findMany({
    where: { status: WaitlistStatus.PENDING },
    orderBy: { submittedAt: "asc" },
    take: count,
  });

  // Approve each one
  const approved: WaitlistEntry[] = [];

  for (const entry of pendingEntries) {
    const approvedEntry = await approveWaitlistEntry(entry.id, approvedById);
    approved.push(approvedEntry);
  }

  return approved;
}

/**
 * Verify an approval token for account creation
 */
export async function verifyApprovalToken(token: string): Promise<{
  valid: boolean;
  reason?: "expired" | "used" | "not_found";
  entry?: WaitlistEntry;
}> {
  const entry = await prisma.waitlist.findUnique({
    where: { approvalToken: token },
    include: {
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!entry) {
    return { valid: false, reason: "not_found" };
  }

  // Check if already used
  if (entry.status === WaitlistStatus.COMPLETED) {
    return { valid: false, reason: "used" };
  }

  // Check if expired
  if (entry.tokenExpiresAt && entry.tokenExpiresAt < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, entry: entry as WaitlistEntry };
}

/**
 * Mark waitlist entry as completed (account created)
 */
export async function markWaitlistCompleted(token: string): Promise<void> {
  await prisma.waitlist.update({
    where: { approvalToken: token },
    data: {
      status: WaitlistStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}

/**
 * Check if email can proceed with login/signup
 * Returns status for UI feedback
 */
export async function checkEmailStatus(email: string): Promise<{
  canProceed: boolean;
  status: "demo" | "approved" | "pending" | "rejected" | "not_found";
  entry?: WaitlistEntry;
}> {
  // Demo accounts bypass
  if (isDemoAccount(email)) {
    return { canProceed: true, status: "demo" };
  }

  const entry = await getWaitlistByEmail(email);

  if (!entry) {
    return { canProceed: false, status: "not_found" };
  }

  switch (entry.status) {
    case WaitlistStatus.APPROVED:
    case WaitlistStatus.COMPLETED:
      return { canProceed: true, status: "approved", entry };
    case WaitlistStatus.PENDING:
      return { canProceed: false, status: "pending", entry };
    case WaitlistStatus.REJECTED:
      return { canProceed: false, status: "rejected", entry };
    default:
      return { canProceed: false, status: "not_found" };
  }
}
