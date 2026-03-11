/**
 * Scrybe Service Worker
 * Provides offline support, caching, and background sync
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `scrybe-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `scrybe-dynamic-${CACHE_VERSION}`;
const API_CACHE = `scrybe-api-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.json",
];

// API routes that should be cached for offline access
const CACHEABLE_API_ROUTES = [
  "/api/forms",
  "/api/clients",
  "/api/programs",
  "/api/reminders",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith("scrybe-") &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== API_CACHE
            );
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip Chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static assets (CSS, JS, images)
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isCacheable = CACHEABLE_API_ROUTES.some((route) =>
    url.pathname.startsWith(route)
  );

  try {
    const response = await fetch(request);

    // Cache successful GET responses for cacheable routes
    if (response.ok && isCacheable) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Return cached response if available
    if (isCacheable) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log("[SW] Returning cached API response:", url.pathname);
        return cachedResponse;
      }
    }

    // Return error response
    return new Response(
      JSON.stringify({
        error: { code: "OFFLINE", message: "You are currently offline" },
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Handle navigation with network-first, fallback to cache, then offline page
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);

    // Cache successful navigation responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Try to return cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log("[SW] Returning cached page");
      return cachedResponse;
    }

    // Return offline page
    const offlinePage = await caches.match("/offline");
    if (offlinePage) {
      return offlinePage;
    }

    // Last resort - return a basic offline response
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Scrybe</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; }
            h1 { color: #0f172a; }
            p { color: #64748b; }
          </style>
        </head>
        <body>
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </body>
      </html>`,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // For images, return a placeholder
    if (request.destination === "image") {
      return new Response(
        `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#f1f5f9"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8">
            Offline
          </text>
        </svg>`,
        {
          headers: { "Content-Type": "image/svg+xml" },
        }
      );
    }

    throw error;
  }
}

// Background sync for offline form submissions
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync triggered:", event.tag);

  if (event.tag === "sync-form-submissions") {
    event.waitUntil(syncFormSubmissions());
  }

  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

// Sync queued form submissions
async function syncFormSubmissions() {
  console.log("[SW] Syncing form submissions...");

  try {
    const db = await openIndexedDB();
    const tx = db.transaction("pending-submissions", "readonly");
    const store = tx.objectStore("pending-submissions");
    const submissions = await store.getAll();

    for (const submission of submissions) {
      try {
        const response = await fetch(submission.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission.data),
        });

        if (response.ok) {
          // Remove from pending queue
          const deleteTx = db.transaction("pending-submissions", "readwrite");
          const deleteStore = deleteTx.objectStore("pending-submissions");
          await deleteStore.delete(submission.id);
          console.log("[SW] Synced submission:", submission.id);
        }
      } catch (error) {
        console.error("[SW] Failed to sync submission:", submission.id, error);
      }
    }
  } catch (error) {
    console.error("[SW] Error syncing form submissions:", error);
  }
}

// Sync queued messages
async function syncMessages() {
  console.log("[SW] Syncing messages...");

  try {
    const db = await openIndexedDB();
    const tx = db.transaction("pending-messages", "readonly");
    const store = tx.objectStore("pending-messages");
    const messages = await store.getAll();

    for (const message of messages) {
      try {
        const response = await fetch(message.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.data),
        });

        if (response.ok) {
          const deleteTx = db.transaction("pending-messages", "readwrite");
          const deleteStore = deleteTx.objectStore("pending-messages");
          await deleteStore.delete(message.id);
          console.log("[SW] Synced message:", message.id);
        }
      } catch (error) {
        console.error("[SW] Failed to sync message:", message.id, error);
      }
    }
  } catch (error) {
    console.error("[SW] Error syncing messages:", error);
  }
}

// Open IndexedDB for offline data storage
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("scrybe-offline", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("pending-submissions")) {
        db.createObjectStore("pending-submissions", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("pending-messages")) {
        db.createObjectStore("pending-messages", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("cached-data")) {
        db.createObjectStore("cached-data", { keyPath: "key" });
      }
    };
  });
}

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  const data = event.data?.json() ?? {};
  const title = data.title || "Scrybe";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: data.tag || "default",
    data: data.data || {},
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

console.log("[SW] Service worker loaded");
