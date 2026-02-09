"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface NoteAuthor {
  id: string;
  name: string | null;
  email: string;
}

export interface ClientNote {
  id: string;
  content: string;
  type: "INTERNAL" | "SHAREABLE";
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED";
  tags: string[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  author: NoteAuthor;
  approvedBy?: NoteAuthor | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

export interface NotesFilters {
  tags?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  search?: string;
  status?: string;
}

interface UseClientNotesOptions {
  clientId: string;
  filters?: NotesFilters;
  limit?: number;
  enabled?: boolean;
}

interface UseClientNotesResult {
  notes: ClientNote[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  cursor: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Custom hook for fetching client notes with filtering, search, and pagination.
 * Implements cursor-based pagination for infinite scroll.
 */
export function useClientNotes({
  clientId,
  filters = {},
  limit = 20,
  enabled = true,
}: UseClientNotesOptions): UseClientNotesResult {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Track the current fetch request to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build query params from filters
  const buildQueryParams = useCallback((cursorValue?: string | null): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());

    if (cursorValue) {
      params.set("cursor", cursorValue);
    }

    if (filters.tags && filters.tags.length > 0) {
      // Send tags as comma-separated string
      params.set("tags", filters.tags.join(","));
    }

    if (filters.startDate) {
      params.set("startDate", filters.startDate.toISOString());
    }

    if (filters.endDate) {
      params.set("endDate", filters.endDate.toISOString());
    }

    if (filters.search && filters.search.trim()) {
      params.set("search", filters.search.trim());
    }

    if (filters.status) {
      params.set("status", filters.status);
    }

    return params;
  }, [filters, limit]);

  // Fetch notes from API
  const fetchNotes = useCallback(async (
    cursorValue?: string | null,
    append = false
  ) => {
    if (!enabled) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params = buildQueryParams(cursorValue);
      const response = await fetch(
        `/api/clients/${clientId}/notes?${params.toString()}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Failed to fetch notes");
      }

      const data = await response.json();

      // Handle both array and paginated response formats
      const notesData = Array.isArray(data.data) ? data.data : (data.data?.notes || []);
      const newCursor = data.data?.cursor || null;
      const moreAvailable = data.data?.hasMore || false;

      if (append) {
        setNotes((prev) => [...prev, ...notesData]);
      } else {
        setNotes(notesData);
      }

      setCursor(newCursor);
      setHasMore(moreAvailable);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }

      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      console.error("Error fetching client notes:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [clientId, enabled, buildQueryParams]);

  // Load more notes (for infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursor) return;
    await fetchNotes(cursor, true);
  }, [cursor, hasMore, isLoadingMore, fetchNotes]);

  // Refetch notes (reset pagination)
  const refetch = useCallback(async () => {
    setCursor(null);
    await fetchNotes(null, false);
  }, [fetchNotes]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchNotes(null, false);

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNotes]);

  return {
    notes,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    cursor,
    refetch,
    loadMore,
  };
}
