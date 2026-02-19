/**
 * Migration Script: RBAC Data Migration
 *
 * This script migrates existing data to the new RBAC system by:
 * 1. Converting existing Program facilitatorId fields to ProgramMember records
 * 2. Ensuring existing active users retain their current roles
 *
 * Note: New invite default to VIEWER is handled by changing the default in the
 * invite flow code, not by this migration.
 *
 * Run with: npx ts-node scripts/migrate-rbac-data.ts
 *
 * NOTE: This is a one-time migration script. Run it once after deploying
 * the new schema. It's idempotent - running it again won't create duplicates.
 */

import { PrismaClient, ProgramMemberRole } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateFacilitatorsToProgramMembers() {
  console.log("Starting migration of Program facilitators to ProgramMember records...\n");

  // Get all programs with a facilitatorId that don't already have a member record for that user
  const programs = await prisma.program.findMany({
    where: {
      facilitatorId: { not: null },
      archivedAt: null,
    },
    include: {
      facilitator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  let membersCreated = 0;
  let membersSkipped = 0;

  for (const program of programs) {
    if (!program.facilitatorId || !program.facilitator) {
      continue;
    }

    // Check if already a member
    const existingMember = program.members.find(
      (m) => m.userId === program.facilitatorId
    );

    if (existingMember) {
      console.log(
        `  Skipping "${program.name}" - facilitator "${program.facilitator.name || program.facilitator.email}" already a member`
      );
      membersSkipped++;
      continue;
    }

    try {
      // Create ProgramMember record for the facilitator
      await prisma.programMember.create({
        data: {
          programId: program.id,
          userId: program.facilitatorId,
          role: ProgramMemberRole.FACILITATOR,
          canEditEnrollments: false,
          canEditAttendance: true,
          canViewAllClients: true, // Facilitators typically see all session attendees
          assignedBy: program.createdById,
        },
      });

      console.log(
        `  Created member for "${program.name}" - facilitator "${program.facilitator.name || program.facilitator.email}"`
      );
      membersCreated++;
    } catch (error) {
      console.error(
        `  Error migrating facilitator for "${program.name}":`,
        error
      );
    }
  }

  console.log(
    `\nFacilitator migration complete: ${membersCreated} created, ${membersSkipped} skipped\n`
  );
  return { membersCreated, membersSkipped };
}

async function migrateCreatorsToProgramMembers() {
  console.log("Starting migration of Program creators to ProgramMember records...\n");

  // Get all programs where the creator isn't already a member
  const programs = await prisma.program.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  let managersCreated = 0;
  let managersSkipped = 0;

  for (const program of programs) {
    // Check if creator is already a member
    const existingMember = program.members.find(
      (m) => m.userId === program.createdById
    );

    if (existingMember) {
      console.log(
        `  Skipping "${program.name}" - creator "${program.createdBy.name || program.createdBy.email}" already a member`
      );
      managersSkipped++;
      continue;
    }

    // Skip if creator is an admin (they have access to everything already)
    if (program.createdBy.role === "ADMIN" || program.createdBy.role === "SUPER_ADMIN") {
      console.log(
        `  Skipping "${program.name}" - creator "${program.createdBy.name || program.createdBy.email}" is admin`
      );
      managersSkipped++;
      continue;
    }

    try {
      // Create ProgramMember record for the creator as MANAGER
      await prisma.programMember.create({
        data: {
          programId: program.id,
          userId: program.createdById,
          role: ProgramMemberRole.MANAGER,
          canEditEnrollments: true,
          canEditAttendance: true,
          canViewAllClients: true,
          assignedBy: program.createdById, // Self-assigned on creation
        },
      });

      console.log(
        `  Created manager for "${program.name}" - creator "${program.createdBy.name || program.createdBy.email}"`
      );
      managersCreated++;
    } catch (error) {
      console.error(
        `  Error migrating creator for "${program.name}":`,
        error
      );
    }
  }

  console.log(
    `\nCreator migration complete: ${managersCreated} created, ${managersSkipped} skipped\n`
  );
  return { managersCreated, managersSkipped };
}

async function verifyUserRoles() {
  console.log("Verifying existing user roles...\n");

  // Get all active users by role
  const usersByRole = await prisma.user.groupBy({
    by: ["role"],
    where: {
      isActive: true,
    },
    _count: {
      id: true,
    },
  });

  console.log("Current active user role distribution:");
  for (const roleGroup of usersByRole) {
    console.log(`  ${roleGroup.role}: ${roleGroup._count.id} users`);
  }

  console.log("");
  return usersByRole;
}

async function main() {
  console.log("=".repeat(60));
  console.log("RBAC Data Migration");
  console.log("=".repeat(60));
  console.log("");

  try {
    // First, verify current user roles
    await verifyUserRoles();

    // Migrate program facilitators
    const facilitatorResults = await migrateFacilitatorsToProgramMembers();

    // Migrate program creators (non-admins)
    const creatorResults = await migrateCreatorsToProgramMembers();

    console.log("=".repeat(60));
    console.log("Migration Summary");
    console.log("=".repeat(60));
    console.log(
      `Facilitators:  ${facilitatorResults.membersCreated} migrated, ${facilitatorResults.membersSkipped} skipped`
    );
    console.log(
      `Creators:      ${creatorResults.managersCreated} migrated, ${creatorResults.managersSkipped} skipped`
    );
    console.log("");
    console.log("Migration completed successfully!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Update invite flow to default new users to VIEWER role");
    console.log("2. Review existing user roles and adjust as needed");
    console.log("3. Test RBAC permissions for each role type");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
