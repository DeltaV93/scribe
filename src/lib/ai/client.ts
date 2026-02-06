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

/**
 * Log Claude API usage statistics
 * Call this after receiving a response to track token usage
 */
export function logClaudeUsage(
  operation: string,
  model: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
  durationMs: number
): void {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  console.log(
    JSON.stringify({
      event: "claude_api_usage",
      operation,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      duration_ms: Math.round(durationMs),
      tokens_per_second: durationMs > 0 ? Math.round((outputTokens / durationMs) * 1000) : 0,
    })
  );

  console.log(
    `[claude_api_usage] ${operation}: ${Math.round(durationMs)}ms, ` +
      `${inputTokens} input + ${outputTokens} output = ${totalTokens} tokens ` +
      `(${durationMs > 0 ? Math.round((outputTokens / durationMs) * 1000) : 0} tokens/sec)`
  );
}
