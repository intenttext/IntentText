/**
 * trust-alias-hole.test.ts — FORMAT-REVIEW T-01 regression.
 *
 * THE HOLE (verified pre-fix): the content hash excludes `amendment:` lines
 * (trust.ts), and `leadKeyword` resolves aliases through ALIAS_MAP *before* that
 * exclusion runs. Because `change` was registered as an alias of `amendment`, an
 * ordinary English sentence written as a keyword line — `change: we lowered the
 * price` — resolved to `amendment` and was SILENTLY DROPPED from the sealed
 * content hash. The seal claimed to cover content it provably did not.
 *
 * THE FIX: drop the `change` alias, and forbid any trust-category keyword that is
 * excluded from the content hash (`amendment`, `certify`) from aliasing a common
 * English prose word. These tests fail if the hole is ever reopened.
 */
import { describe, it, expect } from "vitest";
import { computeDocumentHash } from "../src/trust";
import { ALIAS_MAP } from "../src/language-registry";

const BASE = "title: Service Agreement\nsection: Terms\ntext: The fee is 1000.\n";

describe("T-01: change→amendment seal hole is closed", () => {
  it("a `change:` line now AFFECTS the content hash (it is real content)", () => {
    const tampered =
      BASE + "change: the fee is now 0 and the term is void\n";
    // Pre-fix these hashed identically (the change line vanished from the hash).
    expect(computeDocumentHash(tampered)).not.toBe(computeDocumentHash(BASE));
  });

  it("a genuine `amendment:` line is STILL excluded from the content hash", () => {
    // We removed the alias, NOT the legitimate amendment exclusion: a post-seal
    // amendment record must not retroactively change the body's content hash.
    const withAmendment = BASE + "amendment: clarified clause 3 | ref: v1\n";
    expect(computeDocumentHash(withAmendment)).toBe(computeDocumentHash(BASE));
  });

  it("amendment has NO ASCII alias (change & amend dropped); only the Arabic term", () => {
    expect(ALIAS_MAP.change).toBeUndefined();
    expect(ALIAS_MAP.amend).toBeUndefined();
    expect(ALIAS_MAP["تعديل"]).toBe("amendment"); // deliberate localized equivalent
  });
});

describe("T-01 guard: hash-excluded trust keywords have NO ASCII-word alias", () => {
  // Keywords dropped from the CONTENT hash by trust.ts — any alias of these is
  // invisible to a signature, so an English-word alias would let an ordinary
  // sentence resolve into one and vanish from a seal (the `change` hole).
  const HASH_EXCLUDED_TRUST = new Set(["amendment", "certify"]);

  it("no ASCII-letter alias resolves to amendment/certify (localized terms OK)", () => {
    // The strong form, stronger than a denylist and impossible to out-maintain: a
    // hash-excluded trust keyword may alias only NON-ASCII localized terms (e.g.
    // Arabic تعديل — the deliberate formal equivalent of the canonical), never a
    // plain English word. This is exactly how Arabic stays first-class AND safe.
    const offenders: string[] = [];
    for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
      if (HASH_EXCLUDED_TRUST.has(canonical) && /^[A-Za-z][A-Za-z-]*$/.test(alias)) {
        offenders.push(`${alias} → ${canonical}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
