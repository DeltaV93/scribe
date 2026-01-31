/**
 * Meeting Processing Job Processor
 *
 * Handles asynchronous meeting transcription, summarization, and email distribution.
 */

import { Job } from "bullmq";
import { executeMeetingProcessing } from "@/lib/services/meetings";
import { registerProcessor } from "../worker";
import { MeetingProcessingJobData } from "../queue";

/**
 * Process a meeting job
 */
async function processMeeting(job: Job<MeetingProcessingJobData>): Promise<void> {
  const { meetingId, orgId, userId, recordingPath, jobProgressId, options } = job.data;

  console.log(`Processing meeting job for meeting ${meetingId}`);

  await executeMeetingProcessing({
    meetingId,
    orgId,
    userId,
    recordingPath,
    jobProgressId,
    options,
  });

  console.log(`Meeting processing completed for ${meetingId}`);
}

// Register this processor
registerProcessor("meeting-processing", processMeeting);
