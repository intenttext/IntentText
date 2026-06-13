// useTrustBadges — lazily computes the trust lifecycle (draft / tracked /
// approved / signed / sealed) for every .it file in the library, so the tree
// can show status badges. Results are cached by path + mtime.

import { useEffect, useRef, useState } from "react";
import { parseIntentText } from "@dotit/core";
import { extractTrustState } from "@dotit/editor";
import { readFile } from "../lib/backend";
import type { TreeNode } from "../lib/backend";

export type TrustBadge =
  | "draft"
  | "tracked"
  | "approved"
  | "signed"
  | "sealed"
  | "error";

interface CacheEntry {
  mtime: number;
  badge: TrustBadge;
}

const MAX_FILES = 400;
const CONCURRENCY = 6;

export function useTrustBadges(
  files: TreeNode[],
  revision: number,
): Map<string, TrustBadge> {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [badges, setBadges] = useState<Map<string, TrustBadge>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const pending = files
      .slice(0, MAX_FILES)
      .filter((f) => cache.get(f.path)?.mtime !== f.modified);

    const publish = () => {
      if (cancelled) return;
      const next = new Map<string, TrustBadge>();
      for (const f of files) {
        const entry = cache.get(f.path);
        if (entry) next.set(f.path, entry.badge);
      }
      setBadges(next);
    };

    if (pending.length === 0) {
      publish();
      return;
    }

    let index = 0;
    const worker = async () => {
      while (!cancelled && index < pending.length) {
        const file = pending[index++];
        let badge: TrustBadge = "error";
        try {
          const source = await readFile(file.path);
          const trust = extractTrustState(parseIntentText(source));
          badge = trust.lifecycle;
        } catch {
          badge = "error";
        }
        cache.set(file.path, { mtime: file.modified, badge });
      }
    };

    Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker),
    ).then(publish);
    publish();

    return () => {
      cancelled = true;
    };
  }, [files, revision]);

  return badges;
}
