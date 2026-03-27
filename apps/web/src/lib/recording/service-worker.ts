/**
 * Service Worker Registration & Background Sync (PX-RECOVERY Phase 2)
 *
 * Handles:
 * - Service worker registration
 * - Background sync registration for recording uploads
 * - Communication with service worker
 *
 * Note: Background Sync API is only supported in Chrome/Edge.
 * Other browsers fall back to online event handling.
 */

// Service worker path
const SW_PATH = "/recording-sw.js";

// ============================================================================
// Service Worker Registration
// ============================================================================

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator;
}

/**
 * Check if background sync is supported
 */
export function isBackgroundSyncSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "SyncManager" in window;
}

/**
 * Register the recording service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.log("[ServiceWorker] Not supported in this browser");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });

    console.log("[ServiceWorker] Registered successfully");

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error("[ServiceWorker] Registration failed:", error);
    return null;
  }
}

/**
 * Get the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch (error) {
    console.error("[ServiceWorker] Unregistration failed:", error);
    return false;
  }
}

// ============================================================================
// Background Sync
// ============================================================================

/**
 * Register a background sync for uploading a recording
 */
export async function registerRecordingSync(
  conversationId: string
): Promise<boolean> {
  if (!isBackgroundSyncSupported()) {
    console.log("[BackgroundSync] Not supported, falling back to online event");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // @ts-expect-error - SyncManager is not in TypeScript types yet
    await registration.sync.register(`upload-recording-${conversationId}`);

    console.log(`[BackgroundSync] Registered sync for conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error("[BackgroundSync] Registration failed:", error);
    return false;
  }
}

/**
 * Check if there are pending syncs for a conversation
 */
export async function hasPendingSync(conversationId: string): Promise<boolean> {
  if (!isBackgroundSyncSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // @ts-expect-error - SyncManager is not in TypeScript types yet
    const tags = await registration.sync.getTags();

    return tags.includes(`upload-recording-${conversationId}`);
  } catch {
    return false;
  }
}

// ============================================================================
// Service Worker Communication
// ============================================================================

/**
 * Send a message to the service worker
 */
export async function postMessageToSW(
  message: { type: string; data?: unknown }
): Promise<unknown> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const controller = registration.active;

  if (!controller) {
    console.warn("[ServiceWorker] No active controller");
    return null;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    controller.postMessage(message, [channel.port2]);

    // Timeout after 5 seconds
    setTimeout(() => resolve(null), 5000);
  });
}

/**
 * Listen for messages from the service worker
 */
export function onServiceWorkerMessage(
  callback: (event: MessageEvent) => void
): () => void {
  if (!isServiceWorkerSupported()) {
    return () => {};
  }

  navigator.serviceWorker.addEventListener("message", callback);

  return () => {
    navigator.serviceWorker.removeEventListener("message", callback);
  };
}

/**
 * Get the service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  const response = await postMessageToSW({ type: "GET_VERSION" });

  if (response && typeof response === "object" && "version" in response) {
    return (response as { version: string }).version;
  }

  return null;
}

// ============================================================================
// Online/Offline Handling (Fallback for non-BackgroundSync browsers)
// ============================================================================

/**
 * Register an online event handler for uploading pending recordings
 */
export function onOnline(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", callback);

  return () => {
    window.removeEventListener("online", callback);
  };
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}
