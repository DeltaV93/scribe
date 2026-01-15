import { prisma } from "@/lib/db";
import { ClientStatus, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateClientInput {
  orgId: string;
  createdBy: string;
  assignedTo: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: ClientAddress | null;
  additionalPhones?: AdditionalPhone[] | null;
  internalId?: string | null;
  status?: ClientStatus;
}

export interface UpdateClientInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string | null;
  address?: ClientAddress | null;
  additionalPhones?: AdditionalPhone[] | null;
  internalId?: string | null;
  status?: ClientStatus;
  assignedTo?: string;
}

export interface ClientAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  formatted?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface AdditionalPhone {
  number: string;
  label: string; // e.g., "Work", "Home", "Mobile"
}

export interface ClientFilters {
  status?: ClientStatus;
  assignedTo?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface DuplicateCheckResult {
  hasPotentialDuplicate: boolean;
  score: number;
  matches: DuplicateMatch[];
}

export interface DuplicateMatch {
  clientId: string;
  clientName: string;
  matchReasons: string[];
  score: number;
}

export interface ClientWithRelations {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  phone: string;
  additionalPhones: AdditionalPhone[] | null;
  email: string | null;
  address: ClientAddress | null;
  internalId: string | null;
  status: ClientStatus;
  assignedTo: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
}

// ============================================
// CLIENT CRUD
// ============================================

/**
 * Create a new client
 */
export async function createClient(input: CreateClientInput): Promise<ClientWithRelations> {
  const client = await prisma.client.create({
    data: {
      orgId: input.orgId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: normalizePhoneNumber(input.phone),
      email: input.email || null,
      address: input.address ? (input.address as unknown as Prisma.JsonObject) : Prisma.JsonNull,
      additionalPhones: input.additionalPhones
        ? (input.additionalPhones as unknown as Prisma.JsonArray)
        : Prisma.JsonNull,
      internalId: input.internalId || null,
      status: input.status || ClientStatus.ACTIVE,
      assignedTo: input.assignedTo,
      createdBy: input.createdBy,
    },
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
      creator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { calls: true, notes: true, formSubmissions: true },
      },
    },
  });

  return transformClient(client);
}

/**
 * Get a client by ID
 */
export async function getClientById(
  clientId: string,
  orgId: string
): Promise<ClientWithRelations | null> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      orgId: orgId,
      deletedAt: null,
    },
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
      creator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { calls: true, notes: true, formSubmissions: true },
      },
    },
  });

  if (!client) return null;
  return transformClient(client);
}

/**
 * Update a client
 */
export async function updateClient(
  clientId: string,
  orgId: string,
  input: UpdateClientInput
): Promise<ClientWithRelations> {
  const updateData: Prisma.ClientUpdateInput = {};

  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.lastName !== undefined) updateData.lastName = input.lastName;
  if (input.phone !== undefined) updateData.phone = normalizePhoneNumber(input.phone);
  if (input.email !== undefined) updateData.email = input.email;
  if (input.address !== undefined)
    updateData.address = input.address
      ? (input.address as unknown as Prisma.JsonObject)
      : Prisma.JsonNull;
  if (input.additionalPhones !== undefined)
    updateData.additionalPhones = input.additionalPhones
      ? (input.additionalPhones as unknown as Prisma.JsonArray)
      : Prisma.JsonNull;
  if (input.internalId !== undefined) updateData.internalId = input.internalId;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.assignedTo !== undefined)
    updateData.assignedUser = { connect: { id: input.assignedTo } };

  const client = await prisma.client.update({
    where: {
      id: clientId,
      orgId: orgId,
    },
    data: updateData,
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
      creator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { calls: true, notes: true, formSubmissions: true },
      },
    },
  });

  return transformClient(client);
}

/**
 * Soft delete a client
 */
export async function softDeleteClient(clientId: string, orgId: string): Promise<void> {
  await prisma.client.update({
    where: {
      id: clientId,
      orgId: orgId,
    },
    data: {
      deletedAt: new Date(),
      status: ClientStatus.CLOSED,
    },
  });
}

/**
 * List clients with filters and pagination
 */
export async function listClients(
  orgId: string,
  filters: ClientFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ clients: ClientWithRelations[]; total: number; page: number; limit: number }> {
  const { status, assignedTo, search } = filters;
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ClientWhereInput = {
    orgId,
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  if (assignedTo) {
    where.assignedTo = assignedTo;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { internalId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { calls: true, notes: true, formSubmissions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    clients: clients.map(transformClient),
    total,
    page,
    limit,
  };
}

// ============================================
// DUPLICATE DETECTION
// ============================================

/**
 * Check for potential duplicate clients
 */
export async function checkForDuplicates(
  orgId: string,
  phone: string,
  firstName: string,
  lastName: string
): Promise<DuplicateCheckResult> {
  const normalizedPhone = normalizePhoneNumber(phone);
  const matches: DuplicateMatch[] = [];

  // 1. Check for exact phone match (score: 100)
  const phoneMatch = await prisma.client.findFirst({
    where: {
      orgId,
      phone: normalizedPhone,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (phoneMatch) {
    return {
      hasPotentialDuplicate: true,
      score: 100,
      matches: [
        {
          clientId: phoneMatch.id,
          clientName: `${phoneMatch.firstName} ${phoneMatch.lastName}`,
          matchReasons: ["Exact phone number match"],
          score: 100,
        },
      ],
    };
  }

  // 2. Check for fuzzy name matches
  // Using simple SQL similarity check (PostgreSQL pg_trgm would be better but this works)
  const potentialMatches = await prisma.client.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        // Case-insensitive name matching
        {
          firstName: { contains: firstName.substring(0, 3), mode: "insensitive" },
          lastName: { contains: lastName.substring(0, 3), mode: "insensitive" },
        },
        // Swapped names
        {
          firstName: { contains: lastName.substring(0, 3), mode: "insensitive" },
          lastName: { contains: firstName.substring(0, 3), mode: "insensitive" },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
    take: 10,
  });

  for (const match of potentialMatches) {
    const matchReasons: string[] = [];
    let score = 0;

    // Calculate Levenshtein-like similarity
    const firstNameSimilarity = calculateStringSimilarity(
      firstName.toLowerCase(),
      match.firstName.toLowerCase()
    );
    const lastNameSimilarity = calculateStringSimilarity(
      lastName.toLowerCase(),
      match.lastName.toLowerCase()
    );

    if (firstNameSimilarity > 0.8) {
      matchReasons.push("Similar first name");
      score += 25;
    }

    if (lastNameSimilarity > 0.8) {
      matchReasons.push("Similar last name");
      score += 25;
    }

    // Check for phonetic match using soundex-like comparison
    if (soundsLike(firstName, match.firstName)) {
      matchReasons.push("First name sounds similar");
      score += 15;
    }

    if (soundsLike(lastName, match.lastName)) {
      matchReasons.push("Last name sounds similar");
      score += 15;
    }

    if (score >= 70 && matchReasons.length > 0) {
      matches.push({
        clientId: match.id,
        clientName: `${match.firstName} ${match.lastName}`,
        matchReasons,
        score,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return {
    hasPotentialDuplicate: matches.length > 0,
    score: matches.length > 0 ? Math.max(...matches.map((m) => m.score)) : 0,
    matches: matches.slice(0, 5), // Return top 5 matches
  };
}

// ============================================
// CLIENT RELATED DATA
// ============================================

/**
 * Get client's call history
 */
export async function getClientCalls(clientId: string, limit: number = 10) {
  const calls = await prisma.call.findMany({
    where: { clientId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      caseManager: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return calls;
}

/**
 * Get client's notes
 */
export async function getClientNotes(clientId: string) {
  const notes = await prisma.note.findMany({
    where: {
      clientId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return notes;
}

/**
 * Get client's form submissions
 */
export async function getClientFormSubmissions(clientId: string) {
  const submissions = await prisma.formSubmission.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      form: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  return submissions;
}

/**
 * Get client caseload count for a user
 */
export async function getCaseloadCount(userId: string, orgId: string): Promise<number> {
  return prisma.client.count({
    where: {
      orgId,
      assignedTo: userId,
      deletedAt: null,
      status: { not: ClientStatus.CLOSED },
    },
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize phone number to 10 digits
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it starts with 1 and has 11 digits, remove the 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

/**
 * Calculate string similarity (Sørensen–Dice coefficient)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }

  const bigrams2: string[] = [];
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.push(str2.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigrams2) {
    if (bigrams1.has(bigram)) {
      intersection++;
      bigrams1.delete(bigram); // Only count once
    }
  }

  return (2 * intersection) / (str1.length - 1 + str2.length - 1);
}

/**
 * Simple phonetic comparison (soundex-like)
 */
function soundsLike(str1: string, str2: string): boolean {
  const soundex1 = simpleSoundex(str1);
  const soundex2 = simpleSoundex(str2);
  return soundex1 === soundex2;
}

/**
 * Simplified soundex implementation
 */
function simpleSoundex(str: string): string {
  if (!str) return "";

  const s = str.toUpperCase();
  const codes: Record<string, string> = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };

  let soundex = s[0];
  let lastCode = codes[s[0]] || "";

  for (let i = 1; i < s.length && soundex.length < 4; i++) {
    const code = codes[s[i]];
    if (code && code !== lastCode) {
      soundex += code;
      lastCode = code;
    } else if (!code) {
      lastCode = "";
    }
  }

  return soundex.padEnd(4, "0");
}

/**
 * Transform Prisma client to our type
 */
function transformClient(client: any): ClientWithRelations {
  return {
    id: client.id,
    orgId: client.orgId,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    additionalPhones: client.additionalPhones as AdditionalPhone[] | null,
    email: client.email,
    address: client.address as ClientAddress | null,
    internalId: client.internalId,
    status: client.status,
    assignedTo: client.assignedTo,
    createdBy: client.createdBy,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    deletedAt: client.deletedAt,
    assignedUser: client.assignedUser,
    creator: client.creator,
    _count: client._count,
  };
}
