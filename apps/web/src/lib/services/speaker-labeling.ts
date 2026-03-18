/**
 * Speaker Labeling Service
 *
 * Manages speaker labels for diarized conversation transcripts.
 * Labels are stored in InPersonDetails.participants JSON field.
 */

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export type SpeakerRole = "staff" | "client" | "other";

export interface SpeakerLabel {
  speakerId: string; // e.g., "Speaker 0", "Speaker 1"
  role: SpeakerRole;
  name?: string;
  userId?: string; // If linked to a system user
  clientId?: string; // If linked to a client record
}

export interface SpeakerLabelsResult {
  conversationId: string;
  labels: SpeakerLabel[];
  detectedSpeakers: string[]; // All speakers found in transcript
}

// Internal type for JSON parsing
interface ParticipantEntry {
  speakerId?: string;
  role?: string;
  name?: string;
  userId?: string;
  clientId?: string;
  email?: string;
}

// ============================================
// GET SPEAKER LABELS
// ============================================

/**
 * Extract unique speakers from transcript JSON
 */
export function extractSpeakersFromTranscript(
  transcriptJson: Prisma.JsonValue | null
): string[] {
  if (!Array.isArray(transcriptJson)) {
    return [];
  }

  const speakers = new Set<string>();
  for (const segment of transcriptJson) {
    if (typeof segment === "object" && segment !== null && "speaker" in segment) {
      const speaker = (segment as { speaker?: string }).speaker;
      if (speaker) {
        speakers.add(speaker);
      }
    }
  }

  // Sort speakers naturally (Speaker 0, Speaker 1, etc.)
  return Array.from(speakers).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

/**
 * Check if an entry is a speaker label (has speakerId)
 */
function isSpeakerLabel(entry: unknown): entry is ParticipantEntry & { speakerId: string } {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "speakerId" in entry &&
    typeof (entry as ParticipantEntry).speakerId === "string"
  );
}

/**
 * Get speaker labels for a conversation
 */
export async function getSpeakerLabels(
  conversationId: string
): Promise<SpeakerLabelsResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      transcriptJson: true,
      inPersonDetails: {
        select: {
          participants: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Extract speakers from transcript
  const detectedSpeakers = extractSpeakersFromTranscript(
    conversation.transcriptJson
  );

  // Parse existing labels from participants
  const participants = conversation.inPersonDetails?.participants;
  const labels: SpeakerLabel[] = [];

  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (isSpeakerLabel(p)) {
        labels.push({
          speakerId: p.speakerId,
          role: (p.role as SpeakerRole) || "other",
          name: p.name,
          userId: p.userId,
          clientId: p.clientId,
        });
      }
    }
  }

  return {
    conversationId,
    labels,
    detectedSpeakers,
  };
}

// ============================================
// UPDATE SPEAKER LABELS
// ============================================

export interface UpdateSpeakerLabelsInput {
  labels: SpeakerLabel[];
}

/**
 * Update speaker labels for a conversation
 *
 * This merges the new labels with existing participant data,
 * preserving any non-speaker entries.
 */
export async function updateSpeakerLabels(
  conversationId: string,
  input: UpdateSpeakerLabelsInput
): Promise<SpeakerLabelsResult> {
  // Get current conversation data
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      transcriptJson: true,
      inPersonDetails: {
        select: {
          id: true,
          participants: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Only IN_PERSON conversations have InPersonDetails
  if (conversation.type !== "IN_PERSON") {
    throw new Error("Speaker labeling is only available for in-person conversations");
  }

  // Extract detected speakers
  const detectedSpeakers = extractSpeakersFromTranscript(
    conversation.transcriptJson
  );

  // Validate that all labels reference valid speakers
  for (const label of input.labels) {
    if (!detectedSpeakers.includes(label.speakerId)) {
      throw new Error(`Invalid speaker ID: ${label.speakerId}`);
    }
  }

  // Get existing participants (non-speaker entries)
  const existingParticipants = conversation.inPersonDetails?.participants;
  const nonSpeakerEntries: Prisma.JsonValue[] = [];

  if (Array.isArray(existingParticipants)) {
    for (const p of existingParticipants) {
      if (!isSpeakerLabel(p)) {
        nonSpeakerEntries.push(p as Prisma.JsonValue);
      }
    }
  }

  // Merge: non-speaker entries + new speaker labels
  const updatedParticipants: Prisma.JsonArray = [
    ...nonSpeakerEntries,
    ...input.labels.map((l) => ({
      speakerId: l.speakerId,
      role: l.role,
      name: l.name,
      userId: l.userId,
      clientId: l.clientId,
    })),
  ];

  // Update InPersonDetails
  if (conversation.inPersonDetails) {
    await prisma.inPersonDetails.update({
      where: { id: conversation.inPersonDetails.id },
      data: {
        participants: updatedParticipants,
      },
    });
  } else {
    // Create InPersonDetails if it doesn't exist
    await prisma.inPersonDetails.create({
      data: {
        conversationId,
        participants: updatedParticipants,
      },
    });
  }

  return {
    conversationId,
    labels: input.labels,
    detectedSpeakers,
  };
}

// ============================================
// HELPER: GET SPEAKER DISPLAY NAME
// ============================================

/**
 * Get display name for a speaker based on labels
 */
export function getSpeakerDisplayName(
  speakerId: string,
  labels: SpeakerLabel[]
): { name: string; role: SpeakerRole } {
  const label = labels.find((l) => l.speakerId === speakerId);

  if (label) {
    return {
      name: label.name || formatRoleDisplay(label.role),
      role: label.role,
    };
  }

  return {
    name: speakerId,
    role: "other",
  };
}

function formatRoleDisplay(role: SpeakerRole): string {
  switch (role) {
    case "staff":
      return "Staff";
    case "client":
      return "Client";
    default:
      return "Other";
  }
}

// ============================================
// SPEAKER STATISTICS
// ============================================

export interface SpeakerStats {
  speakerId: string;
  segmentCount: number;
  totalDuration: number; // in seconds
  wordCount: number;
}

/**
 * Get statistics for each speaker in the transcript
 */
export function getSpeakerStats(transcriptJson: Prisma.JsonValue | null): SpeakerStats[] {
  if (!Array.isArray(transcriptJson)) {
    return [];
  }

  const statsMap = new Map<string, SpeakerStats>();

  for (const segment of transcriptJson) {
    if (typeof segment !== "object" || segment === null) continue;

    const seg = segment as {
      speaker?: string;
      startTime?: number;
      endTime?: number;
      text?: string;
    };

    const speaker = seg.speaker;
    if (!speaker) continue;

    const existing = statsMap.get(speaker) || {
      speakerId: speaker,
      segmentCount: 0,
      totalDuration: 0,
      wordCount: 0,
    };

    existing.segmentCount += 1;
    existing.totalDuration += (seg.endTime || 0) - (seg.startTime || 0);
    existing.wordCount += (seg.text || "").split(/\s+/).filter(Boolean).length;

    statsMap.set(speaker, existing);
  }

  // Sort by speaker ID
  return Array.from(statsMap.values()).sort((a, b) => {
    const numA = parseInt(a.speakerId.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.speakerId.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}
