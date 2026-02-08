import { prisma } from "@/lib/db";
import { AvailabilityStatus, UserRole as PrismaUserRole, ClientStatus } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CaseManagerProfile {
  id: string;
  userId: string;
  maxCaseload: number;
  currentCaseload: number;
  skills: string[];
  languages: string[];
  specializations: string[];
  availabilityStatus: AvailabilityStatus;
  availabilityNote: string | null;
  preferredClientTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseManagerWithProfile {
  id: string;
  name: string | null;
  email: string;
  role: PrismaUserRole;
  caseManagerProfile: CaseManagerProfile | null;
}

export interface MatchRecommendation {
  caseManager: CaseManagerWithProfile;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
}

export interface ScoreBreakdown {
  caseloadScore: number;
  skillScore: number;
  languageScore: number;
  specializationScore: number;
  availabilityScore: number;
}

export interface ClientMatchPreference {
  id: string;
  clientId: string;
  preferredLanguages: string[];
  requiredSkills: string[];
  specialNeeds: string[];
  notes: string | null;
}

export interface MatchOptions {
  excludeUnavailable?: boolean;
  excludeFullCaseload?: boolean;
  requiredLanguages?: string[];
  requiredSkills?: string[];
}

export interface CreateCaseManagerProfileInput {
  userId: string;
  maxCaseload?: number;
  skills?: string[];
  languages?: string[];
  specializations?: string[];
  availabilityStatus?: AvailabilityStatus;
  availabilityNote?: string;
  preferredClientTypes?: string[];
}

export interface UpdateCaseManagerProfileInput {
  maxCaseload?: number;
  skills?: string[];
  languages?: string[];
  specializations?: string[];
  availabilityStatus?: AvailabilityStatus;
  availabilityNote?: string | null;
  preferredClientTypes?: string[];
}

// ============================================
// SCORING WEIGHTS
// ============================================

const SCORING_WEIGHTS = {
  caseload: 30,       // 30% - Available capacity
  skills: 25,         // 25% - Required skill match
  language: 25,       // 25% - Language match
  specialization: 10, // 10% - Specialization match
  availability: 10,   // 10% - Availability status
};

// ============================================
// CASE MANAGER PROFILE MANAGEMENT
// ============================================

/**
 * Get or create a case manager profile for a user
 */
export async function getOrCreateCaseManagerProfile(
  userId: string,
  orgId: string
): Promise<CaseManagerProfile> {
  // Verify user exists and belongs to org
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId, isActive: true },
    include: { caseManagerProfile: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.caseManagerProfile) {
    return user.caseManagerProfile;
  }

  // Calculate current caseload
  const currentCaseload = await prisma.client.count({
    where: {
      assignedTo: userId,
      deletedAt: null,
      status: { not: ClientStatus.CLOSED },
    },
  });

  // Create default profile
  const profile = await prisma.caseManagerProfile.create({
    data: {
      userId,
      maxCaseload: user.maxCaseload || 30,
      currentCaseload,
      languages: ["English"],
      skills: [],
      specializations: [],
      preferredClientTypes: [],
    },
  });

  return profile;
}

/**
 * Get a case manager profile by user ID
 */
export async function getCaseManagerProfile(
  userId: string,
  orgId: string
): Promise<CaseManagerProfile | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
    include: { caseManagerProfile: true },
  });

  return user?.caseManagerProfile || null;
}

/**
 * Update a case manager profile
 */
export async function updateCaseManagerProfile(
  userId: string,
  orgId: string,
  input: UpdateCaseManagerProfileInput
): Promise<CaseManagerProfile> {
  // Verify user exists and belongs to org
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId, isActive: true },
    include: { caseManagerProfile: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get or create profile
  let profile = user.caseManagerProfile;
  if (!profile) {
    profile = await getOrCreateCaseManagerProfile(userId, orgId);
  }

  // Update profile
  const updated = await prisma.caseManagerProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.maxCaseload !== undefined && { maxCaseload: input.maxCaseload }),
      ...(input.skills !== undefined && { skills: input.skills }),
      ...(input.languages !== undefined && { languages: input.languages }),
      ...(input.specializations !== undefined && { specializations: input.specializations }),
      ...(input.availabilityStatus !== undefined && { availabilityStatus: input.availabilityStatus }),
      ...(input.availabilityNote !== undefined && { availabilityNote: input.availabilityNote }),
      ...(input.preferredClientTypes !== undefined && { preferredClientTypes: input.preferredClientTypes }),
    },
  });

  return updated;
}

/**
 * Sync current caseload count for a case manager
 */
export async function syncCaseloadCount(userId: string): Promise<number> {
  const currentCaseload = await prisma.client.count({
    where: {
      assignedTo: userId,
      deletedAt: null,
      status: { not: ClientStatus.CLOSED },
    },
  });

  await prisma.caseManagerProfile.updateMany({
    where: { userId },
    data: { currentCaseload },
  });

  return currentCaseload;
}

// ============================================
// CLIENT MATCH PREFERENCE MANAGEMENT
// ============================================

/**
 * Get client match preferences
 */
export async function getClientMatchPreference(
  clientId: string,
  orgId: string
): Promise<ClientMatchPreference | null> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
    include: { matchPreference: true },
  });

  return client?.matchPreference || null;
}

/**
 * Update or create client match preferences
 */
export async function upsertClientMatchPreference(
  clientId: string,
  orgId: string,
  data: {
    preferredLanguages?: string[];
    requiredSkills?: string[];
    specialNeeds?: string[];
    notes?: string | null;
  }
): Promise<ClientMatchPreference> {
  // Verify client exists
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const preference = await prisma.clientMatchPreference.upsert({
    where: { clientId },
    create: {
      clientId,
      preferredLanguages: data.preferredLanguages || [],
      requiredSkills: data.requiredSkills || [],
      specialNeeds: data.specialNeeds || [],
      notes: data.notes || null,
    },
    update: {
      ...(data.preferredLanguages !== undefined && { preferredLanguages: data.preferredLanguages }),
      ...(data.requiredSkills !== undefined && { requiredSkills: data.requiredSkills }),
      ...(data.specialNeeds !== undefined && { specialNeeds: data.specialNeeds }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  return preference;
}

// ============================================
// MATCHING ALGORITHM
// ============================================

/**
 * Calculate match score between a client and a case manager
 */
export function calculateMatchScore(
  clientPreference: ClientMatchPreference | null,
  caseManager: CaseManagerWithProfile
): { score: number; breakdown: ScoreBreakdown; reasons: string[] } {
  const profile = caseManager.caseManagerProfile;
  const reasons: string[] = [];

  // Default profile values if no profile exists
  const maxCaseload = profile?.maxCaseload ?? 30;
  const currentCaseload = profile?.currentCaseload ?? 0;
  const languages = profile?.languages ?? ["English"];
  const skills = profile?.skills ?? [];
  const specializations = profile?.specializations ?? [];
  const availabilityStatus = profile?.availabilityStatus ?? AvailabilityStatus.AVAILABLE;

  // 1. Calculate caseload score (lower is better - more capacity)
  let caseloadScore = 0;
  const caseloadCapacity = maxCaseload - currentCaseload;
  if (caseloadCapacity > 10) {
    caseloadScore = 100;
    reasons.push(`High availability: ${caseloadCapacity} spots open`);
  } else if (caseloadCapacity > 5) {
    caseloadScore = 75;
    reasons.push(`Moderate availability: ${caseloadCapacity} spots open`);
  } else if (caseloadCapacity > 0) {
    caseloadScore = 50;
    reasons.push(`Limited availability: ${caseloadCapacity} spots open`);
  } else {
    caseloadScore = 0;
    reasons.push("No availability: caseload full");
  }

  // 2. Calculate language score
  let languageScore = 50; // Default if no preference
  if (clientPreference?.preferredLanguages && clientPreference.preferredLanguages.length > 0) {
    const languageMatches = clientPreference.preferredLanguages.filter((lang) =>
      languages.some((cmLang) => cmLang.toLowerCase() === lang.toLowerCase())
    );

    if (languageMatches.length === clientPreference.preferredLanguages.length) {
      languageScore = 100;
      reasons.push(`Speaks all preferred languages: ${languageMatches.join(", ")}`);
    } else if (languageMatches.length > 0) {
      languageScore = 70;
      reasons.push(`Speaks some preferred languages: ${languageMatches.join(", ")}`);
    } else {
      languageScore = 20;
      reasons.push("No language match");
    }
  } else {
    // Check if English is spoken (default)
    if (languages.some((l) => l.toLowerCase() === "english")) {
      languageScore = 80;
    }
  }

  // 3. Calculate skill score
  let skillScore = 50; // Default if no requirement
  if (clientPreference?.requiredSkills && clientPreference.requiredSkills.length > 0) {
    const skillMatches = clientPreference.requiredSkills.filter((skill) =>
      skills.some((cmSkill) => cmSkill.toLowerCase() === skill.toLowerCase())
    );

    if (skillMatches.length === clientPreference.requiredSkills.length) {
      skillScore = 100;
      reasons.push(`Has all required skills: ${skillMatches.join(", ")}`);
    } else if (skillMatches.length > 0) {
      skillScore = 50 + (skillMatches.length / clientPreference.requiredSkills.length) * 50;
      reasons.push(`Has some required skills: ${skillMatches.join(", ")}`);
    } else {
      skillScore = 20;
      reasons.push("No skill match");
    }
  }

  // 4. Calculate specialization score
  let specializationScore = 50; // Default if no preference
  if (clientPreference?.specialNeeds && clientPreference.specialNeeds.length > 0) {
    const specMatches = clientPreference.specialNeeds.filter((need) =>
      specializations.some((spec) => spec.toLowerCase().includes(need.toLowerCase()) ||
                                     need.toLowerCase().includes(spec.toLowerCase()))
    );

    if (specMatches.length > 0) {
      specializationScore = 70 + (specMatches.length / clientPreference.specialNeeds.length) * 30;
      reasons.push(`Specialization match: ${specMatches.join(", ")}`);
    } else {
      specializationScore = 30;
    }
  }

  // 5. Calculate availability score
  let availabilityScore = 0;
  switch (availabilityStatus) {
    case AvailabilityStatus.AVAILABLE:
      availabilityScore = 100;
      break;
    case AvailabilityStatus.LIMITED:
      availabilityScore = 60;
      reasons.push("Limited availability");
      break;
    case AvailabilityStatus.UNAVAILABLE:
      availabilityScore = 10;
      reasons.push("Currently unavailable");
      break;
    case AvailabilityStatus.ON_LEAVE:
      availabilityScore = 0;
      reasons.push("On leave");
      break;
  }

  // Calculate weighted total score
  const breakdown: ScoreBreakdown = {
    caseloadScore,
    skillScore,
    languageScore,
    specializationScore,
    availabilityScore,
  };

  const totalScore = Math.round(
    (caseloadScore * SCORING_WEIGHTS.caseload +
      skillScore * SCORING_WEIGHTS.skills +
      languageScore * SCORING_WEIGHTS.language +
      specializationScore * SCORING_WEIGHTS.specialization +
      availabilityScore * SCORING_WEIGHTS.availability) /
      100
  );

  return { score: totalScore, breakdown, reasons };
}

/**
 * Find the best matching case managers for a client
 */
export async function findBestMatch(
  clientId: string,
  orgId: string,
  options: MatchOptions = {}
): Promise<MatchRecommendation[]> {
  const {
    excludeUnavailable = true,
    excludeFullCaseload = true,
    requiredLanguages,
    requiredSkills,
  } = options;

  // Get client and their preferences
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
    include: { matchPreference: true },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Build client preference from stored preferences and override options
  const clientPreference: ClientMatchPreference | null = client.matchPreference
    ? {
        ...client.matchPreference,
        preferredLanguages: requiredLanguages || client.matchPreference.preferredLanguages,
        requiredSkills: requiredSkills || client.matchPreference.requiredSkills,
      }
    : requiredLanguages || requiredSkills
    ? {
        id: "",
        clientId,
        preferredLanguages: requiredLanguages || [],
        requiredSkills: requiredSkills || [],
        specialNeeds: [],
        notes: null,
      }
    : null;

  // Get all case managers in the organization with their profiles
  const caseManagers = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { in: [PrismaUserRole.CASE_MANAGER, PrismaUserRole.PROGRAM_MANAGER] },
      ...(excludeUnavailable && {
        OR: [
          { caseManagerProfile: null },
          {
            caseManagerProfile: {
              availabilityStatus: { notIn: [AvailabilityStatus.UNAVAILABLE, AvailabilityStatus.ON_LEAVE] },
            },
          },
        ],
      }),
    },
    include: {
      caseManagerProfile: true,
    },
  });

  // Calculate scores for each case manager
  const recommendations: MatchRecommendation[] = [];

  for (const cm of caseManagers) {
    // Skip if caseload is full and that option is set
    if (excludeFullCaseload && cm.caseManagerProfile) {
      const { maxCaseload, currentCaseload } = cm.caseManagerProfile;
      if (currentCaseload >= maxCaseload) {
        continue;
      }
    }

    const caseManagerWithProfile: CaseManagerWithProfile = {
      id: cm.id,
      name: cm.name,
      email: cm.email,
      role: cm.role,
      caseManagerProfile: cm.caseManagerProfile,
    };

    const { score, breakdown, reasons } = calculateMatchScore(clientPreference, caseManagerWithProfile);

    recommendations.push({
      caseManager: caseManagerWithProfile,
      score,
      scoreBreakdown: breakdown,
      reasons,
    });
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * Get top N match recommendations for a client
 */
export async function getMatchRecommendations(
  clientId: string,
  orgId: string,
  limit: number = 5,
  options: MatchOptions = {}
): Promise<MatchRecommendation[]> {
  const recommendations = await findBestMatch(clientId, orgId, options);
  return recommendations.slice(0, limit);
}

/**
 * Assign a client to a case manager
 */
export async function assignClient(
  clientId: string,
  caseManagerId: string,
  orgId: string
): Promise<void> {
  // Verify client exists
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Verify case manager exists and can accept clients
  const caseManager = await prisma.user.findFirst({
    where: {
      id: caseManagerId,
      orgId,
      isActive: true,
      role: { in: [PrismaUserRole.CASE_MANAGER, PrismaUserRole.PROGRAM_MANAGER, PrismaUserRole.ADMIN] },
    },
    include: { caseManagerProfile: true },
  });

  if (!caseManager) {
    throw new Error("Case manager not found or is not eligible to receive clients");
  }

  // Check caseload capacity
  if (caseManager.caseManagerProfile) {
    const { maxCaseload, currentCaseload } = caseManager.caseManagerProfile;
    if (currentCaseload >= maxCaseload) {
      throw new Error(`Case manager has reached maximum caseload (${maxCaseload})`);
    }
  }

  const previousAssignee = client.assignedTo;

  // Update client assignment in a transaction
  await prisma.$transaction(async (tx) => {
    // Assign client to new case manager
    await tx.client.update({
      where: { id: clientId },
      data: { assignedTo: caseManagerId },
    });

    // Update caseload counts if profiles exist
    // Increment new case manager's caseload
    await tx.caseManagerProfile.updateMany({
      where: { userId: caseManagerId },
      data: { currentCaseload: { increment: 1 } },
    });

    // Decrement previous case manager's caseload (if different and exists)
    if (previousAssignee && previousAssignee !== caseManagerId) {
      await tx.caseManagerProfile.updateMany({
        where: { userId: previousAssignee },
        data: { currentCaseload: { decrement: 1 } },
      });
    }
  });
}

// ============================================
// CASE MANAGER AVAILABILITY
// ============================================

/**
 * List available case managers in an organization
 */
export async function listAvailableCaseManagers(
  orgId: string,
  options: {
    includeUnavailable?: boolean;
    includeFull?: boolean;
  } = {}
): Promise<CaseManagerWithProfile[]> {
  const { includeUnavailable = false, includeFull = false } = options;

  const whereClause: Record<string, unknown> = {
    orgId,
    isActive: true,
    role: { in: [PrismaUserRole.CASE_MANAGER, PrismaUserRole.PROGRAM_MANAGER] },
  };

  if (!includeUnavailable) {
    whereClause.OR = [
      { caseManagerProfile: null },
      {
        caseManagerProfile: {
          availabilityStatus: { notIn: [AvailabilityStatus.UNAVAILABLE, AvailabilityStatus.ON_LEAVE] },
        },
      },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    include: { caseManagerProfile: true },
    orderBy: { name: "asc" },
  });

  // Filter out full caseloads if needed
  const result = users
    .filter((user) => {
      if (includeFull) return true;
      if (!user.caseManagerProfile) return true; // No profile = assume available
      return user.caseManagerProfile.currentCaseload < user.caseManagerProfile.maxCaseload;
    })
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      caseManagerProfile: user.caseManagerProfile,
    }));

  return result;
}

/**
 * Get caseload statistics for all case managers in an organization
 */
export async function getCaseloadStatistics(orgId: string): Promise<{
  total: number;
  available: number;
  atCapacity: number;
  unavailable: number;
  averageLoad: number;
  caseManagers: Array<{
    id: string;
    name: string | null;
    currentCaseload: number;
    maxCaseload: number;
    utilizationPercent: number;
    availabilityStatus: AvailabilityStatus;
  }>;
}> {
  const users = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { in: [PrismaUserRole.CASE_MANAGER, PrismaUserRole.PROGRAM_MANAGER] },
    },
    include: { caseManagerProfile: true },
  });

  let totalCaseload = 0;
  let totalCapacity = 0;
  let available = 0;
  let atCapacity = 0;
  let unavailable = 0;

  const caseManagers = users.map((user) => {
    const profile = user.caseManagerProfile;
    const currentCaseload = profile?.currentCaseload ?? 0;
    const maxCaseload = profile?.maxCaseload ?? 30;
    const availabilityStatus = profile?.availabilityStatus ?? AvailabilityStatus.AVAILABLE;
    const utilizationPercent = maxCaseload > 0 ? Math.round((currentCaseload / maxCaseload) * 100) : 0;

    totalCaseload += currentCaseload;
    totalCapacity += maxCaseload;

    if (availabilityStatus === AvailabilityStatus.UNAVAILABLE ||
        availabilityStatus === AvailabilityStatus.ON_LEAVE) {
      unavailable++;
    } else if (currentCaseload >= maxCaseload) {
      atCapacity++;
    } else {
      available++;
    }

    return {
      id: user.id,
      name: user.name,
      currentCaseload,
      maxCaseload,
      utilizationPercent,
      availabilityStatus,
    };
  });

  return {
    total: users.length,
    available,
    atCapacity,
    unavailable,
    averageLoad: totalCapacity > 0 ? Math.round((totalCaseload / totalCapacity) * 100) : 0,
    caseManagers,
  };
}
