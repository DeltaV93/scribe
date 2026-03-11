import { createClient, DeepgramClient } from "@deepgram/sdk";

let deepgramClient: DeepgramClient | null = null;

/**
 * Get the Deepgram client instance (singleton)
 */
export function getDeepgramClient(): DeepgramClient {
  if (!deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not configured");
    }

    deepgramClient = createClient(apiKey);
  }

  return deepgramClient;
}

/**
 * Check if Deepgram is configured
 */
export function isDeepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}
