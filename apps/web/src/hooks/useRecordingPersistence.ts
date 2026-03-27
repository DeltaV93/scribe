"use client";

/**
 * Recording Persistence Hook (PX-RECOVERY Phase 2)
 *
 * Manages:
 * - IndexedDB storage of audio chunks during recording
 * - Service worker registration for background uploads
 * - Recovery of pending uploads on page load
 * - Cleanup of completed sessions
 */

import { useEffect, useCallback, useRef } from "react";
import {
  isOfflineStorageAvailable,
  startSession,
  getSession,
  updateSessionStatus,
  saveChunk,
  getPendingSessions,
  concatenateChunks,
  deleteSession,
  cleanupOldSessions,
  cleanupCompletedSessions,
  type RecordingSession,
} from "@/lib/recording/offline-db";
import {
  isServiceWorkerSupported,
  isBackgroundSyncSupported,
  registerServiceWorker,
  registerRecordingSync,
  onServiceWorkerMessage,
  onOnline,
  isOnline,
} from "@/lib/recording/service-worker";
import { uploadToPresignedUrl } from "@/lib/recording/upload";

// Chunk interval in milliseconds (10 seconds)
const CHUNK_INTERVAL_MS = 10000;

// ============================================================================
// Hook Types
// ============================================================================

export interface UseRecordingPersistenceConfig {
  conversationId: string;
  deviceId: string;
  orgId: string;
  uploadUrl?: string;
  s3Key?: string;
  enabled?: boolean;
  onRecoveryFound?: (sessions: RecordingSession[]) => void;
  onUploadComplete?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

export interface UseRecordingPersistenceReturn {
  isAvailable: boolean;
  saveAudioChunk: (blob: Blob, chunkIndex: number) => Promise<void>;
  startPersistence: () => Promise<void>;
  stopPersistence: (uploadNow?: boolean) => Promise<void>;
  recoverPendingUploads: () => Promise<void>;
  getPendingCount: () => Promise<number>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRecordingPersistence(
  config: UseRecordingPersistenceConfig
): UseRecordingPersistenceReturn {
  const {
    conversationId,
    deviceId,
    orgId,
    uploadUrl,
    s3Key,
    enabled = true,
    onRecoveryFound,
    onUploadComplete,
    onError,
  } = config;

  const isAvailable = isOfflineStorageAvailable() && enabled;
  const chunkIndexRef = useRef(0);
  const cleanupDoneRef = useRef(false);

  // ============================================================================
  // Service Worker Setup
  // ============================================================================

  useEffect(() => {
    if (!enabled) return;

    // Register service worker on mount
    if (isServiceWorkerSupported()) {
      registerServiceWorker().catch(console.error);
    }

    // Listen for service worker messages
    const unsubscribeSW = onServiceWorkerMessage((event) => {
      const { type, conversationId: msgConversationId } = event.data;

      if (type === "RECORDING_UPLOAD_COMPLETE" && msgConversationId === conversationId) {
        onUploadComplete?.(conversationId);
      }
    });

    // Listen for online events (fallback for non-BackgroundSync browsers)
    const unsubscribeOnline = onOnline(() => {
      if (!isBackgroundSyncSupported()) {
        recoverPendingUploads();
      }
    });

    // Cleanup old sessions periodically
    if (!cleanupDoneRef.current) {
      cleanupDoneRef.current = true;
      cleanupOldSessions().catch(console.error);
      cleanupCompletedSessions().catch(console.error);
    }

    return () => {
      unsubscribeSW();
      unsubscribeOnline();
    };
  }, [enabled, conversationId, onUploadComplete]);

  // ============================================================================
  // Check for Pending Uploads on Mount
  // ============================================================================

  useEffect(() => {
    if (!isAvailable) return;

    getPendingSessions().then((sessions) => {
      if (sessions.length > 0) {
        console.log(`[Persistence] Found ${sessions.length} pending sessions`);
        onRecoveryFound?.(sessions);
      }
    });
  }, [isAvailable, onRecoveryFound]);

  // ============================================================================
  // Persistence Functions
  // ============================================================================

  /**
   * Start a new persistence session
   */
  const startPersistence = useCallback(async () => {
    if (!isAvailable) return;

    try {
      await startSession(conversationId, deviceId, orgId, uploadUrl, s3Key);
      chunkIndexRef.current = 0;
      console.log(`[Persistence] Started session for ${conversationId}`);
    } catch (error) {
      console.error("[Persistence] Failed to start session:", error);
      onError?.("Failed to start offline storage");
    }
  }, [isAvailable, conversationId, deviceId, orgId, uploadUrl, s3Key, onError]);

  /**
   * Save an audio chunk to IndexedDB
   */
  const saveAudioChunk = useCallback(
    async (blob: Blob, chunkIndex: number) => {
      if (!isAvailable) return;

      try {
        await saveChunk(conversationId, chunkIndex, blob);
        chunkIndexRef.current = chunkIndex;
        console.log(`[Persistence] Saved chunk ${chunkIndex} for ${conversationId}`);
      } catch (error) {
        console.error("[Persistence] Failed to save chunk:", error);
        // Don't report error for individual chunks - they can be retried
      }
    },
    [isAvailable, conversationId]
  );

  /**
   * Stop persistence and optionally trigger upload
   */
  const stopPersistence = useCallback(
    async (uploadNow = true) => {
      if (!isAvailable) return;

      try {
        const session = await getSession(conversationId);
        if (!session) return;

        if (uploadNow) {
          // Mark as stopped, waiting for upload
          await updateSessionStatus(conversationId, "stopped");

          // Register for background sync if supported
          if (isBackgroundSyncSupported()) {
            await registerRecordingSync(conversationId);
            console.log(`[Persistence] Registered background sync for ${conversationId}`);
          } else if (isOnline()) {
            // Fallback: upload immediately
            await uploadPendingSession(conversationId);
          }
        } else {
          // Mark as complete without uploading (e.g., user cancelled)
          await deleteSession(conversationId);
          console.log(`[Persistence] Deleted session for ${conversationId}`);
        }
      } catch (error) {
        console.error("[Persistence] Failed to stop session:", error);
        onError?.("Failed to finalize offline storage");
      }
    },
    [isAvailable, conversationId, onError]
  );

  /**
   * Upload a pending session
   */
  const uploadPendingSession = useCallback(
    async (sessionConversationId: string) => {
      try {
        const session = await getSession(sessionConversationId);
        if (!session || session.status === "complete") return;

        await updateSessionStatus(sessionConversationId, "uploading");

        // Concatenate all chunks
        const blob = await concatenateChunks(sessionConversationId);
        if (!blob) {
          throw new Error("No audio chunks found");
        }

        // Get fresh upload URL
        const response = await fetch(
          `/api/conversations/${sessionConversationId}/fresh-upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: "audio/webm" }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { upload } = await response.json();

        // Upload to S3
        await uploadToPresignedUrl(upload.url, blob);

        // Update conversation
        await fetch(`/api/conversations/${sessionConversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingUrl: upload.key }),
        });

        // Trigger processing
        await fetch(`/api/conversations/${sessionConversationId}/process`, {
          method: "POST",
        });

        // Mark as complete and cleanup
        await deleteSession(sessionConversationId);

        console.log(`[Persistence] Uploaded session ${sessionConversationId}`);
        onUploadComplete?.(sessionConversationId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        console.error(`[Persistence] Upload failed for ${sessionConversationId}:`, error);
        await updateSessionStatus(sessionConversationId, "failed", errorMessage);
        onError?.(errorMessage);
      }
    },
    [onUploadComplete, onError]
  );

  /**
   * Recover all pending uploads
   */
  const recoverPendingUploads = useCallback(async () => {
    if (!isAvailable) return;

    try {
      const sessions = await getPendingSessions();

      for (const session of sessions) {
        if (session.status === "recording" || session.status === "stopped") {
          await uploadPendingSession(session.conversationId);
        }
      }
    } catch (error) {
      console.error("[Persistence] Failed to recover pending uploads:", error);
    }
  }, [isAvailable, uploadPendingSession]);

  /**
   * Get count of pending sessions
   */
  const getPendingCount = useCallback(async (): Promise<number> => {
    if (!isAvailable) return 0;

    const sessions = await getPendingSessions();
    return sessions.length;
  }, [isAvailable]);

  return {
    isAvailable,
    saveAudioChunk,
    startPersistence,
    stopPersistence,
    recoverPendingUploads,
    getPendingCount,
  };
}

export { CHUNK_INTERVAL_MS };
