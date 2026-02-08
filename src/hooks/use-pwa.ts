"use client";

import { useState, useEffect, useCallback } from "react";
import {
  initializeOfflineSync,
  getOnlineStatus,
  subscribeToOnlineStatus,
  registerServiceWorker,
  getPendingSubmissions,
  getPendingMessages,
  triggerBackgroundSync,
} from "@/lib/pwa/sync";

interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  hasServiceWorker: boolean;
  pendingSubmissions: number;
  pendingMessages: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Hook for PWA features and offline status
 */
export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isOnline: true,
    isInstallable: false,
    isInstalled: false,
    hasServiceWorker: false,
    pendingSubmissions: 0,
    pendingMessages: 0,
  });

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Initialize PWA features
  useEffect(() => {
    // Check if already installed
    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setState((prev) => ({ ...prev, isInstalled }));

    // Initialize offline sync
    const cleanup = initializeOfflineSync();

    // Set initial online status
    setState((prev) => ({ ...prev, isOnline: getOnlineStatus() }));

    // Subscribe to online status changes
    const unsubscribe = subscribeToOnlineStatus((online) => {
      setState((prev) => ({ ...prev, isOnline: online }));
    });

    // Register service worker
    registerServiceWorker().then((registration) => {
      if (registration) {
        setState((prev) => ({ ...prev, hasServiceWorker: true }));
      }
    });

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setState((prev) => ({ ...prev, isInstallable: true }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check for app installation
    const handleAppInstalled = () => {
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
      setInstallPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      cleanup();
      unsubscribe();
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Update pending counts periodically
  useEffect(() => {
    const updatePendingCounts = async () => {
      try {
        const [submissions, messages] = await Promise.all([
          getPendingSubmissions(),
          getPendingMessages(),
        ]);

        setState((prev) => ({
          ...prev,
          pendingSubmissions: submissions.length,
          pendingMessages: messages.length,
        }));
      } catch (error) {
        console.error("Error getting pending counts:", error);
      }
    };

    updatePendingCounts();
    const interval = setInterval(updatePendingCounts, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, []);

  // Install the app
  const install = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
      setInstallPrompt(null);
      return true;
    }

    return false;
  }, [installPrompt]);

  // Manually trigger sync
  const syncNow = useCallback(() => {
    if (state.isOnline) {
      triggerBackgroundSync();
    }
  }, [state.isOnline]);

  return {
    ...state,
    install,
    syncNow,
  };
}

/**
 * Hook for just online status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const cleanup = initializeOfflineSync();
    setIsOnline(getOnlineStatus());

    const unsubscribe = subscribeToOnlineStatus(setIsOnline);

    return () => {
      cleanup();
      unsubscribe();
    };
  }, []);

  return isOnline;
}
