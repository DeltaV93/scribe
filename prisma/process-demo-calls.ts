/**
 * Script to process demo calls - extract fields and generate summaries
 *
 * Usage: npx tsx prisma/process-demo-calls.ts
 */

import { PrismaClient, ProcessingStatus, ActionItemStatus, ActionItemSource } from '@prisma/client';
import { reExtractCallFields, regenerateCallSummary } from '../src/lib/services/call-processing';
import { onCallCompleted, recordCallActivityOnGoals } from '../src/lib/services/grant-metrics';
import { createDraftsFromCall } from '../src/lib/services/call-goal-drafts';

const prisma = new PrismaClient();

interface AiSummary {
  actionItems?: string[];
  nextSteps?: string[];
  [key: string]: unknown;
}

async function main() {
  console.log('Finding pending demo calls...\n');

  // Find all demo calls that need processing (or already processed but need action items)
  const pendingCalls = await prisma.call.findMany({
    where: {
      id: { startsWith: 'demo-seed-v1-call-' },
      transcriptRaw: { not: null },
    },
    select: {
      id: true,
      formIds: true,
      aiProcessingStatus: true,
      clientId: true,
      client: {
        select: {
          firstName: true,
          lastName: true,
          orgId: true,
        },
      },
    },
  });

  console.log(`Found ${pendingCalls.length} calls to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const call of pendingCalls) {
    const clientName = `${call.client.firstName} ${call.client.lastName}`;
    console.log(`Processing call ${call.id} for ${clientName}...`);

    try {
      const needsProcessing = call.aiProcessingStatus === ProcessingStatus.PENDING;

      if (needsProcessing) {
        // Update status to processing
        await prisma.call.update({
          where: { id: call.id },
          data: { aiProcessingStatus: ProcessingStatus.PROCESSING },
        });

        // Extract fields
        console.log('  - Extracting fields...');
        const extractResult = await reExtractCallFields(call.id, call.formIds);

        if (!extractResult.success) {
          throw new Error(extractResult.error || 'Extraction failed');
        }

        console.log(`  - Extracted ${Object.keys(extractResult.extractedFields || {}).length} fields`);

        // Generate summary
        console.log('  - Generating summary...');
        const summaryResult = await regenerateCallSummary(call.id);

        if (!summaryResult.success) {
          throw new Error(summaryResult.error || 'Summary generation failed');
        }
      } else {
        console.log('  - Already processed, checking action items...');
      }

      // Create CallActionItems from extracted action items
      const updatedCall = await prisma.call.findUnique({
        where: { id: call.id },
        select: { aiSummary: true },
      });

      const aiSummary = updatedCall?.aiSummary as AiSummary | null;
      const actionItems = aiSummary?.actionItems || [];

      if (actionItems.length > 0) {
        console.log(`  - Creating ${actionItems.length} action items...`);

        // Delete existing action items for this call first
        await prisma.callActionItem.deleteMany({
          where: { callId: call.id },
        });

        // Create new action items
        for (const description of actionItems) {
          await prisma.callActionItem.create({
            data: {
              callId: call.id,
              orgId: call.client.orgId,
              description,
              status: ActionItemStatus.OPEN,
              source: ActionItemSource.CALL_TRANSCRIPT,
              aiConfidence: 0.9,
            },
          });
        }
      }

      // Update status to completed if we were processing
      if (needsProcessing) {
        await prisma.call.update({
          where: { id: call.id },
          data: { aiProcessingStatus: ProcessingStatus.COMPLETED },
        });
      }

      // Track grant metrics (simulates what endCall() now does)
      if (call.clientId) {
        console.log('  - Tracking grant metrics...');
        try {
          await onCallCompleted({
            id: call.id,
            clientId: call.clientId,
            orgId: call.client.orgId,
            clientName,
          });

          // Record call activity on ALL goals
          await recordCallActivityOnGoals({
            id: call.id,
            clientId: call.clientId,
            orgId: call.client.orgId,
            clientName,
          });
        } catch (error) {
          console.warn(`  - Grant metrics warning: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // Create goal drafts for rich call context
      console.log('  - Creating goal drafts...');
      try {
        const draftResult = await createDraftsFromCall(call.id);
        if (draftResult.created > 0) {
          console.log(`  - Created ${draftResult.created} goal drafts`);
        } else {
          console.log('  - No applicable goals found for drafts');
        }
      } catch (error) {
        console.warn(`  - Goal drafts warning: ${error instanceof Error ? error.message : 'Unknown'}`);
      }

      console.log('  - Done!\n');
      successCount++;

    } catch (error) {
      console.error(`  - Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);

      // Update status to failed
      await prisma.call.update({
        where: { id: call.id },
        data: { aiProcessingStatus: ProcessingStatus.FAILED },
      });

      errorCount++;
    }
  }

  console.log('\n=== Processing Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error('Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
