import { prisma } from "@/lib/db";
import type { Form, User, Organization } from "@prisma/client";

// Draft with creator and org info for email digest
export interface DraftForDigest {
  id: string;
  name: string;
  fieldCount: number;
  lastEditedAt: Date;
  daysUntilArchive: number;
  editUrl: string;
}

export interface UserDraftDigest {
  userId: string;
  userName: string;
  userEmail: string;
  orgName: string;
  orgTimezone: string;
  drafts: DraftForDigest[];
}

// Days before a draft is archived
const DRAFT_ARCHIVE_DAYS = 30;

// Days before archive to start warning (include in digest)
const WARNING_THRESHOLD_DAYS = 14;

/**
 * Get all draft forms approaching the 30-day archive threshold.
 * Returns drafts that will be archived within the next 14 days.
 */
export async function getDraftsApproachingArchive(orgId?: string): Promise<
  (Form & {
    createdBy: User;
    organization: Organization;
    _count: { fields: number };
  })[]
> {
  const now = new Date();
  const archiveThreshold = new Date(
    now.getTime() - DRAFT_ARCHIVE_DAYS * 24 * 60 * 60 * 1000
  );
  const warningThreshold = new Date(
    now.getTime() - (DRAFT_ARCHIVE_DAYS - WARNING_THRESHOLD_DAYS) * 24 * 60 * 60 * 1000
  );

  return prisma.form.findMany({
    where: {
      status: "DRAFT",
      archivedAt: null,
      updatedAt: {
        gte: archiveThreshold, // Not yet eligible for archive
        lte: warningThreshold, // But within warning period
      },
      ...(orgId ? { orgId } : {}),
    },
    include: {
      createdBy: true,
      organization: true,
      _count: {
        select: { fields: true },
      },
    },
    orderBy: {
      updatedAt: "asc", // Oldest first (closest to archive)
    },
  });
}

/**
 * Get all draft forms that are past the 30-day threshold and should be archived.
 */
export async function getDraftsToArchive(orgId?: string): Promise<Form[]> {
  const archiveThreshold = new Date(
    Date.now() - DRAFT_ARCHIVE_DAYS * 24 * 60 * 60 * 1000
  );

  return prisma.form.findMany({
    where: {
      status: "DRAFT",
      archivedAt: null,
      updatedAt: {
        lt: archiveThreshold,
      },
      ...(orgId ? { orgId } : {}),
    },
  });
}

/**
 * Archive old draft forms that haven't been edited in 30 days.
 * Returns the count of archived forms.
 */
export async function archiveOldDrafts(orgId?: string): Promise<number> {
  const draftsToArchive = await getDraftsToArchive(orgId);

  if (draftsToArchive.length === 0) {
    return 0;
  }

  const result = await prisma.form.updateMany({
    where: {
      id: { in: draftsToArchive.map((d) => d.id) },
    },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Get draft forms grouped by user for the weekly digest email.
 * Only includes drafts that are within the warning threshold (14 days to archive).
 */
export async function getDraftsForDigest(): Promise<UserDraftDigest[]> {
  const drafts = await getDraftsApproachingArchive();

  // Group drafts by user
  const userDraftsMap = new Map<string, {
    user: User;
    org: Organization;
    drafts: (typeof drafts)[number][];
  }>();

  for (const draft of drafts) {
    const userId = draft.createdById;
    if (!userDraftsMap.has(userId)) {
      userDraftsMap.set(userId, {
        user: draft.createdBy,
        org: draft.organization,
        drafts: [],
      });
    }
    userDraftsMap.get(userId)!.drafts.push(draft);
  }

  // Transform to digest format
  const now = new Date();
  const digests: UserDraftDigest[] = [];

  for (const [userId, { user, org, drafts: userDrafts }] of userDraftsMap) {
    // Parse org settings to get timezone
    const settings = (org.settings as { timezone?: string }) || {};
    const timezone = settings.timezone || "America/Los_Angeles";

    const digestDrafts: DraftForDigest[] = userDrafts.map((draft) => {
      const daysSinceEdit = Math.floor(
        (now.getTime() - draft.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      const daysUntilArchive = DRAFT_ARCHIVE_DAYS - daysSinceEdit;

      return {
        id: draft.id,
        name: draft.name || "Untitled Form",
        fieldCount: draft._count.fields,
        lastEditedAt: draft.updatedAt,
        daysUntilArchive: Math.max(0, daysUntilArchive),
        editUrl: `/forms/${draft.id}/edit`,
      };
    });

    // Sort by days until archive (most urgent first)
    digestDrafts.sort((a, b) => a.daysUntilArchive - b.daysUntilArchive);

    digests.push({
      userId,
      userName: user.name || user.email.split("@")[0],
      userEmail: user.email,
      orgName: org.name,
      orgTimezone: timezone,
      drafts: digestDrafts,
    });
  }

  return digests;
}

/**
 * Get a user's personal draft forms (for display in UI).
 */
export async function getUserDrafts(
  userId: string,
  orgId: string
): Promise<(Form & { _count: { fields: number } })[]> {
  return prisma.form.findMany({
    where: {
      createdById: userId,
      orgId,
      status: "DRAFT",
      archivedAt: null,
    },
    include: {
      _count: {
        select: { fields: true },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

/**
 * Get the count of draft forms for a user.
 */
export async function getUserDraftCount(
  userId: string,
  orgId: string
): Promise<number> {
  return prisma.form.count({
    where: {
      createdById: userId,
      orgId,
      status: "DRAFT",
      archivedAt: null,
    },
  });
}

/**
 * Check if today is Monday (for weekly digest scheduling).
 * Uses the org's configured timezone.
 */
export function isDigestDay(timezone: string = "America/Los_Angeles"): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
  return formatter.format(now) === "Monday";
}

/**
 * Check if it's 9am in the given timezone (for weekly digest scheduling).
 */
export function isDigestTime(timezone: string = "America/Los_Angeles"): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  });
  const hour = parseInt(formatter.format(now), 10);
  return hour === 9;
}

/**
 * Get unique timezones from all organizations (for scheduling digest emails).
 */
export async function getOrgTimezones(): Promise<string[]> {
  const orgs = await prisma.organization.findMany({
    select: { settings: true },
  });

  const timezones = new Set<string>();
  for (const org of orgs) {
    const settings = (org.settings as { timezone?: string }) || {};
    timezones.add(settings.timezone || "America/Los_Angeles");
  }

  return Array.from(timezones);
}

/**
 * Get drafts for digest filtered by timezone.
 * Used to send digests at 9am in each timezone.
 */
export async function getDraftsForDigestByTimezone(
  timezone: string
): Promise<UserDraftDigest[]> {
  const allDigests = await getDraftsForDigest();
  return allDigests.filter((digest) => digest.orgTimezone === timezone);
}
