/**
 * IntentText Natural Language Query — v2.10
 *
 * Uses Anthropic API to answer questions about .it documents.
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { ComposedResult } from "./index-builder";

export interface AskOptions {
  /** Maximum tokens for the response. Default: 1024. */
  maxTokens?: number;
  /** Output format hint. Default: "text". */
  format?: "text" | "json";
}

/**
 * Serialize composed results into a compact context string for the LLM.
 */
export function serializeContext(results: ComposedResult[]): string {
  const lines: string[] = [];
  let currentFile = "";

  for (const r of results) {
    if (r.file !== currentFile) {
      currentFile = r.file;
      lines.push(`\n--- ${r.file} ---`);
    }
    const props = Object.entries(r.block.properties)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    const section = r.block.section ? ` [${r.block.section}]` : "";
    lines.push(
      `[${r.block.type}]${section} ${r.block.content}${props ? " | " + props : ""}`,
    );
  }

  return lines.join("\n");
}

/**
 * Ask a natural language question about .it documents.
 * Returns the answer as a string.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 * Uses the Anthropic Messages API directly (no SDK dependency).
 */
export async function askDocuments(
  results: ComposedResult[],
  question: string,
  options: AskOptions = {},
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Error: ANTHROPIC_API_KEY environment variable is not set.\nSet it with: export ANTHROPIC_API_KEY=your-key-here";
  }

  const context = serializeContext(results);
  const maxTokens = options.maxTokens ?? 1024;
  const formatHint =
    options.format === "json"
      ? "\nReturn your answer as valid JSON when possible."
      : "";

  const systemPrompt = `You are a helpful assistant that answers questions about IntentText (.it) documents. You will be given a structured representation of document blocks from one or more .it files. Answer the user's question based only on the provided document data. Be concise and factual.${formatHint}`;

  const userMessage = `Here are the document contents:\n${context}\n\nQuestion: ${question}`;

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return `Error: Anthropic API returned ${response.status}: ${errorText}`;
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const textBlocks = data.content.filter(
    (c: { type: string }) => c.type === "text",
  );
  return textBlocks.map((b: { text: string }) => b.text).join("\n");
}
