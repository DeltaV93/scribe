/**
 * Response Filter Service
 *
 * Provides role-based filtering of client data to prevent PII exposure.
 * Implements data redaction based on user role and client assignment.
 *
 * HIPAA Compliance: This service helps protect PHI by ensuring that users
 * only see the level of detail appropriate for their role.
 */

import { ClientStatus } from "@prisma/client";
import { UserRole, SessionUser } from "@/types";
import type { ClientWithRelations, ClientAddress, AdditionalPhone } from "./clients";

// ============================================
// TYPES
// ============================================

/**
 * Filtered client response with potentially redacted fields
 */
export interface FilteredClient {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  status: ClientStatus;
  phone: string; // May be redacted: XXX-XXX-1234
  additionalPhones: AdditionalPhone[] | null; // May be redacted
  email: string | null; // May be redacted: j***@example.com
  address: ClientAddress | null; // May be null for restricted roles
  internalId: string | null;
  assignedTo: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lastActivityAt: Date | null;
  emailBounced: boolean;
  emailBouncedAt: Date | null;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  creator?: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    calls: number;
    notes: number;
    formSubmissions: number;
  };
  // Metadata about redaction
  _redacted?: {
    phone: boolean;
    email: boolean;
    address: boolean;
  };
}

/**
 * Configuration for which roles can see full contact information
 */
export interface RoleAccessConfig {
  canViewFullPhone: boolean;
  canViewFullEmail: boolean;
  canViewFullAddress: boolean;
  /** If true, access is granted only for assigned clients */
  requiresAssignment: boolean;
}

// ============================================
// ROLE ACCESS CONFIGURATION
// ============================================

/**
 * Role-based access configuration matrix
 *
 * - SUPER_ADMIN, ADMIN: See all fields
 * - PROGRAM_MANAGER: See all fields
 * - CASE_MANAGER: See all fields for assigned clients, redacted for others
 * - VIEWER: Always redacted contact info
 */
const ROLE_ACCESS_CONFIG: Record<UserRole, RoleAccessConfig> = {
  [UserRole.SUPER_ADMIN]: {
    canViewFullPhone: true,
    canViewFullEmail: true,
    canViewFullAddress: true,
    requiresAssignment: false,
  },
  [UserRole.ADMIN]: {
    canViewFullPhone: true,
    canViewFullEmail: true,
    canViewFullAddress: true,
    requiresAssignment: false,
  },
  [UserRole.PROGRAM_MANAGER]: {
    canViewFullPhone: true,
    canViewFullEmail: true,
    canViewFullAddress: true,
    requiresAssignment: false,
  },
  [UserRole.CASE_MANAGER]: {
    canViewFullPhone: true,
    canViewFullEmail: true,
    canViewFullAddress: true,
    requiresAssignment: true, // Only sees full info for assigned clients
  },
  [UserRole.VIEWER]: {
    canViewFullPhone: false,
    canViewFullEmail: false,
    canViewFullAddress: false,
    requiresAssignment: false, // Always restricted regardless of assignment
  },
};

// ============================================
// REDACTION FUNCTIONS
// ============================================

/**
 * Redact phone number to show only last 4 digits
 * Format: XXX-XXX-1234
 *
 * @param phone - The phone number to redact (10 digits expected)
 * @returns Redacted phone number
 *
 * @example
 * redactPhone("5551234567") // "XXX-XXX-4567"
 * redactPhone("1234567890") // "XXX-XXX-7890"
 */
export function redactPhone(phone: string): string {
  if (!phone) return "";

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle 11-digit numbers (with country code)
  const normalizedDigits = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  // Get last 4 digits, pad if necessary
  const lastFour = normalizedDigits.slice(-4).padStart(4, "0");

  return `XXX-XXX-${lastFour}`;
}

/**
 * Redact email to show first letter + *** + @domain
 * Format: j***@example.com
 *
 * @param email - The email address to redact
 * @returns Redacted email address, or null if input is null
 *
 * @example
 * redactEmail("john.doe@example.com") // "j***@example.com"
 * redactEmail("a@test.org")           // "a***@test.org"
 * redactEmail(null)                   // null
 */
export function redactEmail(email: string | null): string | null {
  if (!email) return null;

  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    // Invalid email format, return fully redacted
    return "***";
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex);

  // Show first character of local part, or *** if empty
  const firstChar = localPart.length > 0 ? localPart[0] : "";
  return `${firstChar}***${domain}`;
}

/**
 * Redact additional phone numbers in an array
 *
 * @param phones - Array of additional phone objects
 * @returns Array with redacted phone numbers, or null if input is null
 */
export function redactAdditionalPhones(
  phones: AdditionalPhone[] | null
): AdditionalPhone[] | null {
  if (!phones) return null;

  return phones.map((p) => ({
    ...p,
    number: redactPhone(p.number),
  }));
}

// ============================================
// ACCESS CHECKING FUNCTIONS
// ============================================

/**
 * Determine if a user should see full contact info for a client
 *
 * @param userRole - The user's role
 * @param isAssigned - Whether the client is assigned to this user
 * @returns True if user can see full contact information
 */
export function canViewFullContactInfo(
  userRole: UserRole,
  isAssigned: boolean
): boolean {
  const config = ROLE_ACCESS_CONFIG[userRole];
  if (!config) {
    // Unknown role - default to restricted
    return false;
  }

  if (config.requiresAssignment) {
    // Role requires assignment to see full info
    return isAssigned && config.canViewFullPhone;
  }

  return config.canViewFullPhone;
}

/**
 * Check if a specific field type should be redacted
 *
 * @param userRole - The user's role
 * @param isAssigned - Whether the client is assigned to this user
 * @param fieldType - The type of field to check
 * @returns True if the field should be redacted
 */
export function shouldRedactField(
  userRole: UserRole,
  isAssigned: boolean,
  fieldType: "phone" | "email" | "address"
): boolean {
  const config = ROLE_ACCESS_CONFIG[userRole];
  if (!config) {
    // Unknown role - default to redacted
    return true;
  }

  // Check if role requires assignment for access
  if (config.requiresAssignment && !isAssigned) {
    return true;
  }

  switch (fieldType) {
    case "phone":
      return !config.canViewFullPhone;
    case "email":
      return !config.canViewFullEmail;
    case "address":
      return !config.canViewFullAddress;
    default:
      return true;
  }
}

// ============================================
// MAIN FILTERING FUNCTIONS
// ============================================

/**
 * Filter a single client response based on user role and assignment
 *
 * @param client - The client data to filter
 * @param userRole - The user's role
 * @param isAssigned - Whether this client is assigned to the user
 * @returns Filtered client with potentially redacted fields
 *
 * @example
 * // Admin sees everything
 * filterClientResponse(client, UserRole.ADMIN, false) // Full client data
 *
 * // Case manager sees full data for assigned clients
 * filterClientResponse(client, UserRole.CASE_MANAGER, true) // Full client data
 *
 * // Case manager sees redacted data for unassigned clients
 * filterClientResponse(client, UserRole.CASE_MANAGER, false) // Redacted contact info
 *
 * // Viewer always sees redacted data
 * filterClientResponse(client, UserRole.VIEWER, true) // Redacted contact info
 */
export function filterClientResponse(
  client: ClientWithRelations,
  userRole: UserRole,
  isAssigned: boolean
): FilteredClient {
  const shouldRedactPhone = shouldRedactField(userRole, isAssigned, "phone");
  const shouldRedactEmail = shouldRedactField(userRole, isAssigned, "email");
  const shouldRedactAddress = shouldRedactField(userRole, isAssigned, "address");

  // Track which fields were redacted for transparency
  const redactionInfo = {
    phone: shouldRedactPhone,
    email: shouldRedactEmail,
    address: shouldRedactAddress,
  };

  // If nothing needs redaction, return early with minimal overhead
  const hasRedaction = shouldRedactPhone || shouldRedactEmail || shouldRedactAddress;

  return {
    id: client.id,
    orgId: client.orgId,
    firstName: client.firstName,
    lastName: client.lastName,
    status: client.status,
    phone: shouldRedactPhone ? redactPhone(client.phone) : client.phone,
    additionalPhones: shouldRedactPhone
      ? redactAdditionalPhones(client.additionalPhones)
      : client.additionalPhones,
    email: shouldRedactEmail ? redactEmail(client.email) : client.email,
    address: shouldRedactAddress ? null : client.address,
    internalId: client.internalId,
    assignedTo: client.assignedTo,
    createdBy: client.createdBy,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    deletedAt: client.deletedAt,
    lastActivityAt: client.lastActivityAt,
    emailBounced: client.emailBounced,
    emailBouncedAt: client.emailBouncedAt,
    assignedUser: client.assignedUser,
    creator: client.creator,
    _count: client._count,
    ...(hasRedaction && { _redacted: redactionInfo }),
  };
}

/**
 * Filter a list of clients based on user context
 *
 * @param clients - Array of clients to filter
 * @param user - The session user requesting the data
 * @param assignedClientIds - Set of client IDs assigned to this user
 * @returns Array of filtered clients with potentially redacted fields
 *
 * @example
 * const user = { id: "user-123", role: UserRole.CASE_MANAGER, ... };
 * const assignedIds = new Set(["client-1", "client-2"]);
 * const filteredClients = filterClientListResponse(clients, user, assignedIds);
 */
export function filterClientListResponse(
  clients: ClientWithRelations[],
  user: SessionUser,
  assignedClientIds: Set<string>
): FilteredClient[] {
  return clients.map((client) => {
    const isAssigned = assignedClientIds.has(client.id);
    return filterClientResponse(client, user.role, isAssigned);
  });
}

/**
 * Helper to get assigned client IDs for a user
 * Use this before calling filterClientListResponse when you don't have the set
 *
 * @param clients - Array of clients to check
 * @param userId - The user ID to check assignment against
 * @returns Set of client IDs assigned to the user
 */
export function getAssignedClientIds(
  clients: ClientWithRelations[],
  userId: string
): Set<string> {
  const assignedIds = new Set<string>();
  for (const client of clients) {
    if (client.assignedTo === userId) {
      assignedIds.add(client.id);
    }
  }
  return assignedIds;
}

/**
 * Convenience function to filter clients using only the user session
 * Automatically determines assignment from the client data
 *
 * @param clients - Array of clients to filter
 * @param user - The session user requesting the data
 * @returns Array of filtered clients with potentially redacted fields
 */
export function filterClientsForUser(
  clients: ClientWithRelations[],
  user: SessionUser
): FilteredClient[] {
  const assignedClientIds = getAssignedClientIds(clients, user.id);
  return filterClientListResponse(clients, user, assignedClientIds);
}
