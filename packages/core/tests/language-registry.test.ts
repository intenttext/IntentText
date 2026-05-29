import { describe, it, expect } from "vitest";
import {
  LANGUAGE_REGISTRY,
  CANONICAL_KEYWORDS,
  ALIAS_MAP,
  DEPRECATED_ALIASES,
  BOUNDARY_KEYWORDS,
  EXTENSION_KEYWORDS,
  EXTENSION_LEGACY_ALIASES,
  COMPAT_KEYWORDS,
} from "../src/language-registry";
import { KEYWORDS } from "../src/types";

describe("Language registry parity", () => {
  it("all canonical keywords are in parser KEYWORDS", () => {
    for (const canonical of CANONICAL_KEYWORDS) {
      expect(KEYWORDS).toContain(canonical);
    }
  });

  it("all alias keys are in parser KEYWORDS", () => {
    for (const alias of Object.keys(ALIAS_MAP)) {
      expect(KEYWORDS).toContain(alias);
    }
  });

  it("KEYWORDS contains no entries not in registry", () => {
    const registryAll = new Set([
      ...CANONICAL_KEYWORDS,
      ...Object.keys(ALIAS_MAP),
      ...EXTENSION_KEYWORDS,
      ...Object.keys(EXTENSION_LEGACY_ALIASES),
      ...COMPAT_KEYWORDS,
    ]);
    for (const kw of KEYWORDS) {
      expect(registryAll.has(kw)).toBe(true);
    }
  });

  it("no alias points to a non-registry keyword", () => {
    const allRegistryCanonicals = new Set(
      LANGUAGE_REGISTRY.map((k) => k.canonical),
    );
    for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
      expect(allRegistryCanonicals.has(canonical)).toBe(true);
    }
  });

  it("no duplicate canonical keywords in registry", () => {
    const seen = new Set<string>();
    for (const def of LANGUAGE_REGISTRY) {
      expect(seen.has(def.canonical)).toBe(false);
      seen.add(def.canonical);
    }
  });

  it("no alias appears as both alias and canonical", () => {
    const canonicalSet = new Set(CANONICAL_KEYWORDS);
    for (const alias of Object.keys(ALIAS_MAP)) {
      expect(canonicalSet.has(alias)).toBe(false);
    }
  });

  it("deprecated aliases are all in ALIAS_MAP", () => {
    for (const dep of DEPRECATED_ALIASES) {
      expect(ALIAS_MAP).toHaveProperty(dep);
    }
  });

  it("boundary keywords are in the registry", () => {
    const allRegistryCanonicals = new Set(
      LANGUAGE_REGISTRY.map((k) => k.canonical),
    );
    for (const boundary of BOUNDARY_KEYWORDS) {
      expect(allRegistryCanonicals.has(boundary)).toBe(true);
    }
  });
});
