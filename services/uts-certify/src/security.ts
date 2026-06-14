/**
 * security.ts — middleware and validators that harden the public surface of the
 * UTS certification service (Wave 3 of the production-hardening plan):
 *   - securityHeaders: conservative response headers on every reply
 *   - requireHttps:    refuse plaintext in production (behind a TLS proxy)
 *   - createRateLimiter: per-key/IP fixed-window throttle (in-memory)
 *   - validateEntity / validateCr / clampString: bound + sanitize admin input
 *
 * The rate limiter is in-memory, so it throttles per-instance. For a multi-instance
 * deployment put a shared store (Redis) behind it — documented in DEPLOYMENT.md.
 */
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** Conservative security headers for an API that returns only JSON. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  // This is a JSON API — there is never a reason to execute or frame content.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}

/**
 * In production, refuse requests that did not arrive over HTTPS. The service is
 * meant to sit behind a TLS-terminating proxy, so we trust `x-forwarded-proto`
 * (only meaningful once `trust proxy` is set). Disabled outside production and
 * when REQUIRE_HTTPS=false so local/dev and tests are unaffected.
 */
export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  const enforced =
    process.env.NODE_ENV === "production" && process.env.REQUIRE_HTTPS !== "false";
  if (!enforced) {
    next();
    return;
  }
  const proto = (req.header("x-forwarded-proto") ?? req.protocol ?? "").split(",")[0].trim();
  if (proto === "https" || req.secure) {
    next();
    return;
  }
  res.status(403).json({
    error: "https_required",
    detail: "This endpoint must be reached over HTTPS.",
  });
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Derive the throttle key from the request (e.g. API key hash, else IP). */
  key?: (req: Request) => string;
  name?: string;
}

/** Default key: a hash of the bearer token if present, else the client IP. */
function defaultKey(req: Request): string {
  const h = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (m) return "k:" + createHash("sha256").update(m[1]).digest("hex").slice(0, 24);
  return "ip:" + (req.ip ?? req.socket?.remoteAddress ?? "unknown");
}

/**
 * In-memory fixed-window rate limiter. Returns Express middleware that 429s once a
 * key exceeds `max` requests within `windowMs`. Expired buckets are swept lazily so
 * the map can't grow without bound.
 */
export function createRateLimiter(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyOf = opts.key ?? defaultKey;

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();

    // Lazy sweep when the map gets large, to bound memory.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }

    const k = keyOf(req);
    let b = buckets.get(k);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(k, b);
    }
    b.count++;

    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - b.count)));

    if (b.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      res.status(429).json({ error: "rate_limited", detail: "Too many requests." });
      return;
    }
    next();
  };
}

/** Trim a string and hard-cap its length; returns null if not a usable string. */
export function clampString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t === "") return null;
  return t.length > max ? t.slice(0, max) : t;
}

const ENTITY_MAX = 200;
const CR_MAX = 64;
// Legal names: letters (incl. accented/Arabic), digits, spaces and common
// punctuation. Explicitly excludes control chars, newlines, and the `|` pipe used
// as the .it field separator (so an entity can't smuggle extra certify: fields).
const ENTITY_RE = /^[\p{L}\p{N} .,'’\-&()]+$/u;
const CR_RE = /^[A-Za-z0-9.\-/]+$/;

/** Validate a KYC legal name. Returns the cleaned value or an error reason. */
export function validateEntity(value: unknown): { ok: true; value: string } | { ok: false; reason: string } {
  const s = clampString(value, ENTITY_MAX);
  if (!s) return { ok: false, reason: "`entity` (verified legal name) is required." };
  if (!ENTITY_RE.test(s)) {
    return { ok: false, reason: "`entity` contains disallowed characters." };
  }
  return { ok: true, value: s };
}

/** Validate an optional commercial-registration number. */
export function validateCr(value: unknown): { ok: true; value: string | undefined } | { ok: false; reason: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: undefined };
  const s = clampString(value, CR_MAX);
  if (!s || !CR_RE.test(s)) return { ok: false, reason: "`cr` contains disallowed characters." };
  return { ok: true, value: s };
}
