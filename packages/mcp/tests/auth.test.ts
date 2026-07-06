import { describe, it, expect } from "vitest";
import { checkBearerAuth } from "../src/auth";

// #58: the HTTP MCP transport (`/mcp`) invokes every document tool. Without auth, anyone
// who can reach it can run them. checkBearerAuth is the gate.
describe("#58: MCP bearer-token auth", () => {
  it("DISABLES the endpoint (503) when no token is configured (secure default)", () => {
    const r = checkBearerAuth("Bearer anything", undefined);
    expect(r?.status).toBe(503);
    expect(r?.message).toMatch(/MCP_AUTH_TOKEN/);
  });

  it("401s a missing, malformed, or wrong token", () => {
    expect(checkBearerAuth(undefined, "s3cret")?.status).toBe(401);
    expect(checkBearerAuth("", "s3cret")?.status).toBe(401);
    expect(checkBearerAuth("Bearer wrong", "s3cret")?.status).toBe(401);
    expect(checkBearerAuth("s3cret", "s3cret")?.status).toBe(401); // no Bearer scheme
    expect(checkBearerAuth("Bearer s3cre", "s3cret")?.status).toBe(401); // near-miss (length)
  });

  it("authorizes the correct bearer token (scheme is case-insensitive)", () => {
    expect(checkBearerAuth("Bearer s3cret", "s3cret")).toBeNull();
    expect(checkBearerAuth("bearer s3cret", "s3cret")).toBeNull();
    expect(checkBearerAuth("Bearer   s3cret", "s3cret")).toBeNull(); // extra spaces after scheme
  });
});
