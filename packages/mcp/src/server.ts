import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerParseTools } from "./tools/parse.js";
import { registerRenderTools } from "./tools/render.js";
import { registerMergeTools } from "./tools/merge.js";
import { registerValidateTools } from "./tools/validate.js";
import { registerQueryTools } from "./tools/query.js";
import { registerDiffTools } from "./tools/diff.js";
import { registerSourceTools } from "./tools/source.js";
import { registerWorkflowTools } from "./tools/workflow.js";
import { registerTrustTools } from "./tools/trust.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "intenttext",
    version: "1.4.2",
  });

  registerParseTools(server);
  registerRenderTools(server);
  registerMergeTools(server);
  registerValidateTools(server);
  registerQueryTools(server);
  registerDiffTools(server);
  registerSourceTools(server);
  registerWorkflowTools(server);
  registerTrustTools(server);

  return server;
}
