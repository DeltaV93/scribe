"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";

interface ClientInfo {
  id: string;
  firstName: string;
  lastName: string;
  organization: string;
}

interface PortalSession {
  csrfToken: string;
  client: ClientInfo;
  expiresAt: string;
  requiresPIN: boolean;
}

interface PortalSessionContextValue {
  session: PortalSession | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  pinVerified: boolean;
  setPinVerified: (verified: boolean) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  csrfToken: string | null;
}

const PortalSessionContext = createContext<PortalSessionContextValue | null>(null);

export function usePortalSession() {
  const context = useContext(PortalSessionContext);
  if (!context) {
    throw new Error("usePortalSession must be used within a PortalSessionProvider");
  }
  return context;
}

interface PortalSessionProviderProps {
  children: ReactNode;
  token: string;
}

export function PortalSessionProvider({ children, token }: PortalSessionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);

  const createSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First try to validate existing session cookie
      const sessionRes = await fetch("/api/portal/session", {
        method: "GET",
        credentials: "include",
      });

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setSession(sessionData.data);
        // If we have a valid session from cookie, we're done
        // PIN verification state persists per browser session
        return;
      }

      // No valid session cookie, create new session from token
      const createRes = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error?.message || "Invalid or expired link");
        router.push("/portal/expired");
        return;
      }

      const data = await createRes.json();
      setSession(data.data);

      // Magic link bypasses PIN - set pinVerified if coming from magic link
      // This is the initial auth, so PIN is bypassed
      setPinVerified(true);
    } catch (err) {
      console.error("Error creating session:", err);
      setError("Something went wrong. Please try the link again.");
    } finally {
      setIsLoading(false);
    }
  }, [token, router]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/session", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        setSession(null);
        setError("Session expired");
        router.push("/portal/expired");
        return;
      }

      const data = await res.json();
      setSession(data.data);
    } catch (err) {
      console.error("Error refreshing session:", err);
      setSession(null);
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/portal/session", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (err) {
      console.error("Error logging out:", err);
    } finally {
      setSession(null);
      setPinVerified(false);
      router.push("/portal/expired");
    }
  }, [router]);

  useEffect(() => {
    createSession();
  }, [createSession]);

  // Redirect to PIN page if PIN is required and not verified
  useEffect(() => {
    if (!isLoading && session && session.requiresPIN && !pinVerified) {
      const pinPath = `/portal/${token}/pin`;
      if (pathname !== pinPath) {
        router.push(pinPath);
      }
    }
  }, [isLoading, session, pinVerified, pathname, token, router]);

  const value: PortalSessionContextValue = {
    session,
    isLoading,
    error,
    isAuthenticated: !!session,
    pinVerified,
    setPinVerified,
    logout,
    refreshSession,
    csrfToken: session?.csrfToken || null,
  };

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
    </PortalSessionContext.Provider>
  );
}
