/**
 * Recording Service Worker (PX-RECOVERY Phase 2)
 *
 * Handles background sync for recording uploads when the browser
 * is online but the tab might be closed.
 *
 * Note: Background Sync API is only supported in Chrome/Edge.
 * Other browsers fall back to online event handling.
 */

const SW_VERSION = "1.0.0";
const DB_NAME = "InkraRecordings";

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

self.addEventListener("install", (event) => {
  console.log(`[RecordingSW] Installing v${SW_VERSION}`);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log(`[RecordingSW] Activating v${SW_VERSION}`);
  event.waitUntil(self.clients.claim());
});

// ============================================================================
// Background Sync Handler
// ============================================================================

self.addEventListener("sync", (event) => {
  console.log(`[RecordingSW] Sync event: ${event.tag}`);

  if (event.tag.startsWith("upload-recording-")) {
    const conversationId = event.tag.replace("upload-recording-", "");
    event.waitUntil(handleRecordingUpload(conversationId));
  }
});

/**
 * Handle uploading a pending recording from IndexedDB
 */
async function handleRecordingUpload(conversationId) {
  console.log(`[RecordingSW] Processing upload for conversation ${conversationId}`);

  try {
    // Open IndexedDB to get chunks
    const db = await openDatabase();

    // Get session
    const session = await getSession(db, conversationId);
    if (!session) {
      console.log(`[RecordingSW] No session found for ${conversationId}`);
      return;
    }

    if (session.status === "complete") {
      console.log(`[RecordingSW] Session already complete for ${conversationId}`);
      return;
    }

    // Get all chunks
    const chunks = await getChunks(db, conversationId);
    if (chunks.length === 0) {
      console.log(`[RecordingSW] No chunks found for ${conversationId}`);
      return;
    }

    // Concatenate chunks into single blob
    const blob = new Blob(
      chunks.map((c) => c.blob),
      { type: "audio/webm" }
    );

    // Get fresh upload URL
    const urlResponse = await fetch(
      `/api/conversations/${conversationId}/fresh-upload-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "audio/webm" }),
      }
    );

    if (!urlResponse.ok) {
      throw new Error("Failed to get upload URL");
    }

    const { upload } = await urlResponse.json();

    // Upload to S3
    const uploadResponse = await fetch(upload.url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": "audio/webm" },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    // Update conversation
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingUrl: upload.key }),
    });

    // Trigger processing
    await fetch(`/api/conversations/${conversationId}/process`, {
      method: "POST",
    });

    // Mark session as complete
    await updateSessionStatus(db, conversationId, "complete");

    // Cleanup chunks
    await deleteChunks(db, conversationId);

    console.log(`[RecordingSW] Successfully uploaded conversation ${conversationId}`);

    // Notify any open clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "RECORDING_UPLOAD_COMPLETE",
        conversationId,
      });
    });
  } catch (error) {
    console.error(`[RecordingSW] Upload failed for ${conversationId}:`, error);

    // Update session with error
    try {
      const db = await openDatabase();
      await updateSessionStatus(db, conversationId, "failed", error.message);
    } catch {
      // Ignore DB errors
    }

    throw error; // Re-throw to trigger retry
  }
}

// ============================================================================
// IndexedDB Helpers
// ============================================================================

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("chunks")) {
        const chunksStore = db.createObjectStore("chunks", { keyPath: "id" });
        chunksStore.createIndex("conversationId", "conversationId");
      }

      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "conversationId" });
      }
    };
  });
}

function getSession(db, conversationId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const request = store.get(conversationId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getChunks(db, conversationId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const store = tx.objectStore("chunks");
    const index = store.index("conversationId");
    const request = index.getAll(conversationId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const chunks = request.result || [];
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      resolve(chunks);
    };
  });
}

function updateSessionStatus(db, conversationId, status, error) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const getRequest = store.get(conversationId);

    getRequest.onsuccess = () => {
      const session = getRequest.result;
      if (session) {
        session.status = status;
        session.lastUpdatedAt = new Date();
        if (error) session.error = error;

        const putRequest = store.put(session);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

function deleteChunks(db, conversationId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readwrite");
    const store = tx.objectStore("chunks");
    const index = store.index("conversationId");
    const request = index.openCursor(IDBKeyRange.only(conversationId));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Message Handler (for communication with main thread)
// ============================================================================

self.addEventListener("message", (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "PING":
      event.source.postMessage({ type: "PONG", version: SW_VERSION });
      break;

    case "GET_VERSION":
      event.source.postMessage({ type: "VERSION", version: SW_VERSION });
      break;

    default:
      console.log(`[RecordingSW] Unknown message type: ${type}`);
  }
});
