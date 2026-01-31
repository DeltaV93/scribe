/**
 * Knowledge Base / Institutional Memory Types
 *
 * TypeScript interfaces for the knowledge management system.
 */

import { KnowledgeSource } from "@prisma/client";

// ============================================
// KNOWLEDGE ENTRY TYPES
// ============================================

export interface CreateKnowledgeEntryParams {
  orgId: string;
  createdById: string;
  title: string;
  content: string;
  summary?: string;
  source?: KnowledgeSource;
  meetingId?: string;
  documentPath?: string;
  tags?: string[];
  category?: string;
}

export interface UpdateKnowledgeEntryParams {
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  category?: string;
  isArchived?: boolean;
}

export interface KnowledgeSearchParams {
  orgId: string;
  query?: string;
  source?: KnowledgeSource;
  category?: string;
  tags?: string[];
  meetingId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface SemanticSearchParams {
  orgId: string;
  query: string;
  limit?: number;
  minScore?: number;
  source?: KnowledgeSource;
  category?: string;
  tags?: string[];
}

// ============================================
// EMBEDDING TYPES
// ============================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface SimilarityResult {
  entryId: string;
  score: number;
  title: string;
  content: string;
  summary: string | null;
  source: KnowledgeSource;
  category: string | null;
  tags: string[];
  createdAt: Date;
}

// ============================================
// EXTRACTION TYPES
// ============================================

export interface MeetingKnowledgeExtractionParams {
  meetingId: string;
  orgId: string;
  userId: string;
}

export interface ExtractedKnowledge {
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
}

export interface ExtractionResult {
  entries: ExtractedKnowledge[];
  meetingId: string;
  tokensUsed: number;
  processingTimeMs: number;
}
