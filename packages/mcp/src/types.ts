import type { IntentDocument } from "@dotit/core";

export type { IntentDocument };

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function textResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

/** Shape of an MCP tool result (text content + optional isError flag). */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * An MCP tool result that signals an error to the calling agent WITHOUT
 * crashing the server. Returns the message as text with isError set, so the
 * LLM sees a clear, actionable error instead of a transport failure.
 */
export function errorResult(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

/**
 * Wrap a tool handler so any thrown error is turned into a clean error result
 * the agent can read, rather than propagating and tearing down the connection.
 */
export function safe<A>(
  handler: (args: A) => ToolResult | Promise<ToolResult>,
): (args: A) => Promise<ToolResult> {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  };
}
