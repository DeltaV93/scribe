/**
 * Knowledge Base - Embedding Service
 *
 * Generates vector embeddings for knowledge entries using OpenAI's API.
 * These embeddings enable semantic search across the knowledge base.
 */

import { EmbeddingResult } from "./types";

// OpenAI embedding model
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Rate limiting
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Generate embedding vector for a text string
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Truncate text if too long (OpenAI has token limits)
  const maxChars = 8000; // Approximate, leaving room for tokenization variance
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: truncatedText,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();

      return {
        embedding: data.data[0].embedding,
        model: EMBEDDING_MODEL,
        tokensUsed: data.usage?.total_tokens || 0,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`Embedding generation attempt ${attempt + 1} failed:`, error);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to generate embedding after retries");
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  // Process in parallel with concurrency limit
  const concurrencyLimit = 5;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += concurrencyLimit) {
    const batch = texts.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top K most similar vectors
 */
export function findTopKSimilar(
  queryVector: number[],
  entries: Array<{ id: string; vector: number[] }>,
  k: number = 10,
  minScore: number = 0.5
): Array<{ id: string; score: number }> {
  const similarities = entries.map((entry) => ({
    id: entry.id,
    score: cosineSimilarity(queryVector, entry.vector),
  }));

  return similarities
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Prepare text for embedding by combining title and content
 */
export function prepareTextForEmbedding(
  title: string,
  content: string,
  summary?: string | null
): string {
  const parts = [title];

  if (summary) {
    parts.push(summary);
  }

  parts.push(content);

  return parts.join("\n\n");
}
