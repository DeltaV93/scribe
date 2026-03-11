/**
 * PWA Offline Sync Library
 *
 * Provides utilities for:
 * - Queuing operations when offline
 * - Background sync when connection is restored
 * - IndexedDB storage for offline data
 */

const DB_NAME = "scrybe-offline";
const DB_VERSION = 1;

// ============================================
// TYPES
// ============================================

interface PendingSubmission {
  id: string;
  url: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface PendingMessage {
  id: string;
  url: string;
  data: {
    clientId: string;
    content: string;
    attachments?: string[];
  };
  timestamp: number;
  retryCount: number;
}

interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

// ============================================
// DATABASE
// ============================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for pending form submissions
      if (!db.objectStoreNames.contains("pending-submissions")) {
        const store = db.createObjectStore("pending-submissions", {
          keyPath: "id",
        });
        store.createIndex("timestamp", "timestamp");
      }

      // Store for pending messages
      if (!db.objectStoreNames.contains("pending-messages")) {
        const store = db.createObjectStore("pending-messages", {
          keyPath: "id",
        });
        store.createIndex("timestamp", "timestamp");
      }

      // Store for cached data (clients, forms, etc.)
      if (!db.objectStoreNames.contains("cached-data")) {
        const store = db.createObjectStore("cached-data", { keyPath: "key" });
        store.createIndex("expiresAt", "expiresAt");
      }
    };
  });

  return dbPromise;
}

// ============================================
// OFFLINE STATE
// ============================================

let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
const onlineListeners: Set<(online: boolean) => void> = new Set();

/**
 * Initialize online/offline listeners
 */
export function initializeOfflineSync(): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => {
    isOnline = true;
    onlineListeners.forEach((listener) => listener(true));
    triggerBackgroundSync();
  };

  const handleOffline = () => {
    isOnline = false;
    onlineListeners.forEach((listener) => listener(false));
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Initialize state
  isOnline = navigator.onLine;

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Check if currently online
 */
export function getOnlineStatus(): boolean {
  return isOnline;
}

/**
 * Subscribe to online status changes
 */
export function subscribeToOnlineStatus(
  callback: (online: boolean) => void
): () => void {
  onlineListeners.add(callback);
  return () => {
    onlineListeners.delete(callback);
  };
}

// ============================================
// PENDING SUBMISSIONS
// ============================================

/**
 * Queue a form submission for later sync
 */
export async function queueFormSubmission(
  url: string,
  data: Record<string, unknown>
): Promise<string> {
  const db = await openDatabase();
  const id = `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const submission: PendingSubmission = {
    id,
    url,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-submissions", "readwrite");
    const store = tx.objectStore("pending-submissions");
    const request = store.add(submission);

    request.onsuccess = () => {
      requestBackgroundSync("sync-form-submissions");
      resolve(id);
    };

    request.onerror = () => {
      reject(new Error("Failed to queue submission"));
    };
  });
}

/**
 * Get all pending form submissions
 */
export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-submissions", "readonly");
    const store = tx.objectStore("pending-submissions");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error("Failed to get pending submissions"));
    };
  });
}

/**
 * Remove a pending submission after successful sync
 */
export async function removePendingSubmission(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-submissions", "readwrite");
    const store = tx.objectStore("pending-submissions");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to remove submission"));
  });
}

// ============================================
// PENDING MESSAGES
// ============================================

/**
 * Queue a message for later sync
 */
export async function queueMessage(
  url: string,
  data: PendingMessage["data"]
): Promise<string> {
  const db = await openDatabase();
  const id = `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const message: PendingMessage = {
    id,
    url,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-messages", "readwrite");
    const store = tx.objectStore("pending-messages");
    const request = store.add(message);

    request.onsuccess = () => {
      requestBackgroundSync("sync-messages");
      resolve(id);
    };

    request.onerror = () => {
      reject(new Error("Failed to queue message"));
    };
  });
}

/**
 * Get all pending messages
 */
export async function getPendingMessages(): Promise<PendingMessage[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending-messages", "readonly");
    const store = tx.objectStore("pending-messages");
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error("Failed to get pending messages"));
    };
  });
}

// ============================================
// CACHED DATA
// ============================================

/**
 * Cache data for offline access
 */
export async function cacheData(
  key: string,
  data: unknown,
  ttlMs: number = 1000 * 60 * 60 // 1 hour default
): Promise<void> {
  const db = await openDatabase();

  const cached: CachedData = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-data", "readwrite");
    const store = tx.objectStore("cached-data");
    const request = store.put(cached);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to cache data"));
  });
}

/**
 * Get cached data
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-data", "readonly");
    const store = tx.objectStore("cached-data");
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as CachedData | undefined;

      if (!result) {
        resolve(null);
        return;
      }

      // Check if expired
      if (result.expiresAt < Date.now()) {
        // Delete expired entry
        const deleteTx = db.transaction("cached-data", "readwrite");
        const deleteStore = deleteTx.objectStore("cached-data");
        deleteStore.delete(key);
        resolve(null);
        return;
      }

      resolve(result.data as T);
    };

    request.onerror = () => {
      reject(new Error("Failed to get cached data"));
    };
  });
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await openDatabase();
  const now = Date.now();
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-data", "readwrite");
    const store = tx.objectStore("cached-data");
    const index = store.index("expiresAt");
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(new Error("Failed to clear expired cache"));
  });
}

// ============================================
// BACKGROUND SYNC
// ============================================

/**
 * Request background sync if supported
 */
function requestBackgroundSync(tag: string): void {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        if ("sync" in registration) {
          return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
        }
      })
      .catch((error) => {
        console.warn("Background sync not supported:", error);
      });
  }
}

/**
 * Trigger background sync for all pending data
 */
export function triggerBackgroundSync(): void {
  requestBackgroundSync("sync-form-submissions");
  requestBackgroundSync("sync-messages");
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.log("Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("Service worker registered:", registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 1000 * 60 * 60); // Check every hour

    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
}
