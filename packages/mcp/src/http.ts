#!/usr/bin/env node
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: any, res: any) => {
  res.status(200).json({ ok: true, service: "intenttext-mcp-http" });
});

app.get("/.well-known/mcp/server-card.json", (_req: any, res: any) => {
  res.status(200).json({
    name: "IntentText",
    description:
      "Parse, validate, query, and render IntentText (.it) documents for AI agents",
    repository: "https://github.com/intenttext/intenttext-mcp",
    mcp: {
      transport: "streamable_http",
      endpoint: "/mcp",
    },
  });
});

app.post("/mcp", async (req: any, res: any) => {
  const server = createServer();

  try {
    // Stateless mode is simpler for hosted HTTP deployments.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
    // eslint-disable-next-line no-console
    console.error("Error handling MCP request", error);
  }
});

app.get("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp",
    },
    id: null,
  });
});

app.delete("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp",
    },
    id: null,
  });
});

app.listen(port, host, (error?: Error) => {
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start HTTP MCP wrapper", error);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(
    `IntentText MCP HTTP wrapper listening on http://${host}:${port}/mcp`,
  );
});
