/**
 * Offline Recording Storage (PX-RECOVERY Phase 2)
 *
 * Uses IndexedDB via Dexie to store audio chunks locally during recording.
 * This allows recovery of recordings if the browser crashes or loses connection.
 *
 * Storage strategy:
 * - Chunk every 10 seconds of audio (~150KB per chunk at 128kbps)
 * - Max 360 chunks = 1 hour recording = ~54MB IndexedDB usage
 * - Auto-cleanup after successful S3 upload
 * - Keep failed sessions for 24 hours, then purge
 */

import Dexie, { type EntityTable } from "dexie";

// Recording chunk stored in IndexedDB
export interface RecordingChunk {
  id: string; // `${conversationId}-${chunkIndex}`
  conversationId: string;
  chunkIndex: number;
  blob: Blob;
  timestamp: Date;
  uploaded: boolean;
  uploadAttempts: number;
}

// Recording session metadata
export interface RecordingSession {
  conversationId: string;
  deviceId: string;
  startedAt: Date;
  lastUpdatedAt: Date;
  totalChunks: number;
  uploadedChunks: number;
  status: "recording" | "stopped" | "uploading" | "complete" | "failed";
  uploadUrl?: string; // Original presigned URL
  s3Key?: string; // Expected S3 key
  orgId: string;
  error?: string;
}

// Database schema
class RecordingDatabase extends Dexie {
  chunks!: EntityTable<RecordingChunk, "id">;
  sessions!: EntityTable<RecordingSession, "conversationId">;

  constructor() {
    super("InkraRecordings");

    this.version(1).stores({
      chunks: "id, conversationId, chunkIndex, uploaded",
      sessions: "conversationId, status, deviceId",
    });
  }
}

// Singleton database instance
let db: RecordingDatabase | null = null;

/**
 * Get the database instance (creates if needed)
 */
export function getRecordingDb(): RecordingDatabase {
  if (!db) {
    db = new RecordingDatabase();
  }
  return db;
}

/**
 * Check if IndexedDB is available
 */
export function isOfflineStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return "indexedDB" in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Start a new recording session
 */
export async function startSession(
  conversationId: string,
  deviceId: string,
  orgId: string,
  uploadUrl?: string,
  s3Key?: string
): Promise<void> {
  const db = getRecordingDb();

  await db.sessions.put({
    conversationId,
    deviceId,
    orgId,
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    totalChunks: 0,
    uploadedChunks: 0,
    status: "recording",
    uploadUrl,
    s3Key,
  });
}

/**
 * Get a recording session
 */
export async function getSession(
  conversationId: string
): Promise<RecordingSession | undefined> {
  const db = getRecordingDb();
  return db.sessions.get(conversationId);
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  conversationId: string,
  status: RecordingSession["status"],
  error?: string
): Promise<void> {
  const db = getRecordingDb();

  await db.sessions.update(conversationId, {
    status,
    lastUpdatedAt: new Date(),
    ...(error && { error }),
  });
}

/**
 * Get all pending sessions (not complete or failed)
 */
export async function getPendingSessions(): Promise<RecordingSession[]> {
  const db = getRecordingDb();

  return db.sessions
    .where("status")
    .anyOf(["recording", "stopped", "uploading"])
    .toArray();
}

/**
 * Delete a session and its chunks
 */
export async function deleteSession(conversationId: string): Promise<void> {
  const db = getRecordingDb();

  await db.transaction("rw", [db.sessions, db.chunks], async () => {
    await db.chunks.where({ conversationId }).delete();
    await db.sessions.delete(conversationId);
  });
}

// ============================================================================
// Chunk Management
// ============================================================================

/**
 * Save an audio chunk to IndexedDB
 */
export async function saveChunk(
  conversationId: string,
  chunkIndex: number,
  blob: Blob
): Promise<void> {
  const db = getRecordingDb();

  const chunk: RecordingChunk = {
    id: `${conversationId}-${chunkIndex}`,
    conversationId,
    chunkIndex,
    blob,
    timestamp: new Date(),
    uploaded: false,
    uploadAttempts: 0,
  };

  await db.transaction("rw", [db.chunks, db.sessions], async () => {
    await db.chunks.put(chunk);

    // Update session chunk count
    const session = await db.sessions.get(conversationId);
    if (session) {
      await db.sessions.update(conversationId, {
        totalChunks: Math.max(session.totalChunks, chunkIndex + 1),
        lastUpdatedAt: new Date(),
      });
    }
  });
}

/**
 * Mark a chunk as uploaded
 */
export async function markChunkUploaded(
  conversationId: string,
  chunkIndex: number
): Promise<void> {
  const db = getRecordingDb();

  const chunkId = `${conversationId}-${chunkIndex}`;

  await db.transaction("rw", [db.chunks, db.sessions], async () => {
    await db.chunks.update(chunkId, {
      uploaded: true,
    });

    // Update session uploaded count
    const uploadedCount = await db.chunks
      .where({ conversationId, uploaded: true })
      .count();

    await db.sessions.update(conversationId, {
      uploadedChunks: uploadedCount,
      lastUpdatedAt: new Date(),
    });
  });
}

/**
 * Get all chunks for a conversation
 */
export async function getChunks(conversationId: string): Promise<RecordingChunk[]> {
  const db = getRecordingDb();

  return db.chunks
    .where({ conversationId })
    .sortBy("chunkIndex");
}

/**
 * Get pending (not uploaded) chunks for a conversation
 */
export async function getPendingChunks(
  conversationId: string
): Promise<RecordingChunk[]> {
  const db = getRecordingDb();

  return db.chunks
    .where({ conversationId })
    .filter((chunk) => !chunk.uploaded)
    .sortBy("chunkIndex");
}

/**
 * Increment upload attempt count for a chunk
 */
export async function incrementChunkAttempts(
  conversationId: string,
  chunkIndex: number
): Promise<number> {
  const db = getRecordingDb();

  const chunkId = `${conversationId}-${chunkIndex}`;
  const chunk = await db.chunks.get(chunkId);

  if (!chunk) return 0;

  const newAttempts = chunk.uploadAttempts + 1;
  await db.chunks.update(chunkId, { uploadAttempts: newAttempts });

  return newAttempts;
}

/**
 * Concatenate all chunks into a single Blob
 */
export async function concatenateChunks(conversationId: string): Promise<Blob | null> {
  const chunks = await getChunks(conversationId);

  if (chunks.length === 0) return null;

  // Sort by index to ensure correct order
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Get MIME type from first chunk
  const mimeType = chunks[0].blob.type || "audio/webm";

  // Concatenate all blobs
  return new Blob(
    chunks.map((c) => c.blob),
    { type: mimeType }
  );
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up old sessions (older than 24 hours)
 */
export async function cleanupOldSessions(): Promise<number> {
  const db = getRecordingDb();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const oldSessions = await db.sessions
    .filter((session) => session.lastUpdatedAt < cutoff)
    .toArray();

  let deletedCount = 0;

  for (const session of oldSessions) {
    await deleteSession(session.conversationId);
    deletedCount++;
  }

  console.log(`[OfflineDB] Cleaned up ${deletedCount} old sessions`);
  return deletedCount;
}

/**
 * Clean up completed sessions (keep for 1 hour for debugging)
 */
export async function cleanupCompletedSessions(): Promise<number> {
  const db = getRecordingDb();

  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const completedSessions = await db.sessions
    .where("status")
    .equals("complete")
    .filter((session) => session.lastUpdatedAt < cutoff)
    .toArray();

  let deletedCount = 0;

  for (const session of completedSessions) {
    await deleteSession(session.conversationId);
    deletedCount++;
  }

  console.log(`[OfflineDB] Cleaned up ${deletedCount} completed sessions`);
  return deletedCount;
}

/**
 * Get storage usage stats
 */
export async function getStorageStats(): Promise<{
  sessionCount: number;
  chunkCount: number;
  totalSizeBytes: number;
}> {
  const db = getRecordingDb();

  const sessions = await db.sessions.count();
  const chunks = await db.chunks.toArray();

  let totalSize = 0;
  for (const chunk of chunks) {
    totalSize += chunk.blob.size;
  }

  return {
    sessionCount: sessions,
    chunkCount: chunks.length,
    totalSizeBytes: totalSize,
  };
}
