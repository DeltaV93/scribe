import Anthropic from "@anthropic-ai/sdk";

// Initialize the Anthropic client lazily to ensure it only runs server-side
// This prevents the client from being instantiated during client-side bundling
let _anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error(
      "Anthropic client cannot be used in the browser. Use API routes instead."
    );
  }

  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }

  return _anthropic;
}

// Export a getter instead of the instance directly
export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return getAnthropicClient()[prop as keyof Anthropic];
  },
});

// Default model for extraction tasks
export const EXTRACTION_MODEL = "claude-sonnet-4-20250514";

// Model for quick/cheap operations
export const FAST_MODEL = "claude-sonnet-4-20250514";
