/**
 * Quick test script to verify CallGoalDraft queries work
 * Usage: npx tsx prisma/test-drafts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing CallGoalDraft queries...\n');

  // 1. Check if CallGoalDraft model exists and count records
  try {
    const count = await prisma.callGoalDraft.count();
    console.log(`Total drafts in database: ${count}`);
  } catch (error) {
    console.error('Error counting drafts:', error);
    return;
  }

  // 2. Get a sample draft
  try {
    const sample = await prisma.callGoalDraft.findFirst({
      select: {
        id: true,
        goalId: true,
        callId: true,
        status: true,
        narrative: true,
      },
    });
    console.log('\nSample draft:');
    console.log(JSON.stringify(sample, null, 2));
  } catch (error) {
    console.error('Error fetching sample draft:', error);
    return;
  }

  // 3. Test the full query with relations (same as getPendingDraftsForGoal)
  try {
    const draft = await prisma.callGoalDraft.findFirst({
      where: { status: 'PENDING' },
      include: {
        call: {
          select: {
            startedAt: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    console.log('\nDraft with call relation:');
    console.log(JSON.stringify(draft, null, 2));
  } catch (error) {
    console.error('Error fetching draft with relations:', error);
    return;
  }

  // 4. Get all unique goal IDs that have pending drafts
  try {
    const draftsWithGoals = await prisma.callGoalDraft.findMany({
      where: { status: 'PENDING' },
      select: {
        goalId: true,
        goal: {
          select: {
            name: true,
          },
        },
      },
      distinct: ['goalId'],
      take: 10,
    });
    console.log('\nGoals with pending drafts:');
    for (const d of draftsWithGoals) {
      console.log(`  - ${d.goalId}: ${d.goal.name}`);
    }
  } catch (error) {
    console.error('Error fetching goals with drafts:', error);
  }
}

main()
  .catch((e) => {
    console.error('Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
