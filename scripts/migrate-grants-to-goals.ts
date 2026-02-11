/**
 * Migration Script: Create wrapper Goals for existing Grants and Objectives
 *
 * This script migrates existing data to the new Goals Hub system by:
 * 1. Creating a Goal record for each existing Grant (with type=GRANT)
 * 2. Creating a GoalGrant junction record to link them
 * 3. Creating a Goal record for each existing Objective (with type=OKR)
 * 4. Creating a GoalObjective junction record to link them
 *
 * Run with: npx ts-node scripts/migrate-grants-to-goals.ts
 *
 * NOTE: This is a one-time migration script. Run it once after deploying
 * the new schema. It's idempotent - running it again won't create duplicates.
 */

import { PrismaClient, GoalType, GoalStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateGrantsToGoals() {
  console.log("Starting migration of Grants to Goals...\n");

  // Get all grants that don't already have a wrapper goal
  const grants = await prisma.grant.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      organization: true,
      goalLinks: true,
      deliverables: true,
    },
  });

  let grantsCreated = 0;
  let grantsSkipped = 0;

  for (const grant of grants) {
    // Skip if already has a goal link
    if (grant.goalLinks.length > 0) {
      console.log(`  Skipping grant "${grant.name}" - already linked to goal`);
      grantsSkipped++;
      continue;
    }

    // Map grant status to goal status
    const goalStatus = mapGrantStatusToGoalStatus(grant.status);

    // Calculate progress from deliverables relation
    let progress = 0;
    if (grant.deliverables && grant.deliverables.length > 0) {
      const totalProgress = grant.deliverables.reduce((sum, d) => {
        if (d.targetValue && d.targetValue > 0) {
          return sum + Math.min(100, (d.currentValue / d.targetValue) * 100);
        }
        return sum;
      }, 0);
      progress = Math.round(totalProgress / grant.deliverables.length);
    }

    try {
      // Create the goal
      const goal = await prisma.goal.create({
        data: {
          orgId: grant.orgId,
          name: grant.name,
          description: grant.description,
          type: GoalType.GRANT,
          status: goalStatus,
          startDate: grant.startDate,
          endDate: grant.endDate,
          progress,
          createdById: grant.createdById,
          createdAt: grant.createdAt,
          updatedAt: grant.updatedAt,
        },
      });

      // Create the junction record
      await prisma.goalGrant.create({
        data: {
          goalId: goal.id,
          grantId: grant.id,
          weight: 1.0,
        },
      });

      console.log(`  Created goal for grant "${grant.name}"`);
      grantsCreated++;
    } catch (error) {
      console.error(`  Error migrating grant "${grant.name}":`, error);
    }
  }

  console.log(`\nGrant migration complete: ${grantsCreated} created, ${grantsSkipped} skipped\n`);
  return { grantsCreated, grantsSkipped };
}

async function migrateObjectivesToGoals() {
  console.log("Starting migration of Objectives to Goals...\n");

  // Get all objectives that don't already have a wrapper goal
  const objectives = await prisma.objective.findMany({
    where: {
      archivedAt: null,
    },
    include: {
      organization: true,
      goalLinks: true,
    },
  });

  let objectivesCreated = 0;
  let objectivesSkipped = 0;

  for (const objective of objectives) {
    // Skip if already has a goal link
    if (objective.goalLinks.length > 0) {
      console.log(`  Skipping objective "${objective.title}" - already linked to goal`);
      objectivesSkipped++;
      continue;
    }

    // Map objective status to goal status
    const goalStatus = mapObjectiveStatusToGoalStatus(objective.status);

    try {
      // Create the goal
      const goal = await prisma.goal.create({
        data: {
          orgId: objective.orgId,
          name: objective.title,
          description: objective.description,
          type: GoalType.OKR,
          status: goalStatus,
          startDate: objective.startDate,
          endDate: objective.endDate,
          progress: objective.progress || 0,
          ownerId: objective.ownerId,
          createdById: objective.ownerId, // ownerId is required on Objective
          createdAt: objective.createdAt,
          updatedAt: objective.updatedAt,
        },
      });

      // Create the junction record
      await prisma.goalObjective.create({
        data: {
          goalId: goal.id,
          objectiveId: objective.id,
          weight: 1.0,
        },
      });

      console.log(`  Created goal for objective "${objective.title}"`);
      objectivesCreated++;
    } catch (error) {
      console.error(`  Error migrating objective "${objective.title}":`, error);
    }
  }

  console.log(`\nObjective migration complete: ${objectivesCreated} created, ${objectivesSkipped} skipped\n`);
  return { objectivesCreated, objectivesSkipped };
}

function mapGrantStatusToGoalStatus(grantStatus: string): GoalStatus {
  switch (grantStatus) {
    case "DRAFT":
      return GoalStatus.NOT_STARTED;
    case "ACTIVE":
      return GoalStatus.IN_PROGRESS;
    case "COMPLETED":
      return GoalStatus.COMPLETED;
    case "EXPIRED":
      return GoalStatus.COMPLETED;
    case "CANCELLED":
      return GoalStatus.COMPLETED;
    default:
      return GoalStatus.IN_PROGRESS;
  }
}

function mapObjectiveStatusToGoalStatus(objectiveStatus: string): GoalStatus {
  switch (objectiveStatus) {
    case "DRAFT":
      return GoalStatus.NOT_STARTED;
    case "ACTIVE":
      return GoalStatus.IN_PROGRESS;
    case "COMPLETED":
      return GoalStatus.COMPLETED;
    case "CANCELLED":
      return GoalStatus.COMPLETED;
    case "ON_HOLD":
      return GoalStatus.AT_RISK;
    default:
      return GoalStatus.IN_PROGRESS;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Goals Hub Data Migration");
  console.log("=".repeat(60));
  console.log("");

  try {
    const grantResults = await migrateGrantsToGoals();
    const objectiveResults = await migrateObjectivesToGoals();

    console.log("=".repeat(60));
    console.log("Migration Summary");
    console.log("=".repeat(60));
    console.log(`Grants:     ${grantResults.grantsCreated} migrated, ${grantResults.grantsSkipped} skipped`);
    console.log(`Objectives: ${objectiveResults.objectivesCreated} migrated, ${objectiveResults.objectivesSkipped} skipped`);
    console.log("");
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
