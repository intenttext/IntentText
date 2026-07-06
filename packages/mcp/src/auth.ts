import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token auth for the HTTP MCP transport (finding #58). The `/mcp` endpoint exposes
 * every document tool; without auth, anyone who can reach it can invoke them. This is the
 * gate:
 *   - no token configured  → the endpoint is DISABLED (503) — secure by default, the
 *     operator must set MCP_AUTH_TOKEN to serve it;
 *   - token configured     → require `Authorization: Bearer <token>` (constant-time
 *     compare), else 401.
 * Returns null when the request is authorized, else the {status,message} to send.
 */
export function checkBearerAuth(
  authHeader: string | undefined,
  token: string | undefined,
): { status: number; message: string } | null {
  if (!token) {
    return {
      status: 503,
      message:
        "MCP endpoint disabled: set MCP_AUTH_TOKEN to enable authenticated access.",
    };
  }
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader ?? "").trim());
  const provided = m ? m[1] : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(token, "utf8");
  // Constant-time: equal length AND bytes equal (timingSafeEqual throws on length mismatch).
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    return {
      status: 401,
      message: "Unauthorized: missing or invalid bearer token.",
    };
  }
  return null;
}
