/**
 * defaults.ts — READ-TIME defaults (the faithful-recorder boundary).
 *
 * The parser records ONLY what the author wrote, so the stored model round-trips
 * byte-for-byte — that is the trust moat. Block-type defaults (a `step:`'s pending
 * status, a `parallel:`'s join, a bare `toc:`'s depth/title, a `done:` meaning
 * status done) are NOT baked into the model; they are applied HERE, at read time,
 * by the layers that *interpret* a document (renderer, query, index). One place,
 * so the stored model stays pure and lossless and nothing has to "un-inject" a
 * default on the way back out.
 */
import { IntentBlock } from "./types";

/** The minimal shape defaults need — any block-like value with a type + properties. */
type BlockLike = {
  type: string;
  properties?: Record<string, string | number> | null;
};

/** Default status by block type (`done:` means status done, `step:` pending, …). */
const STATUS_DEFAULTS: Record<string, string> = {
  step: "pending",
  call: "pending",
  done: "done",
  wait: "waiting",
  result: "success",
  gate: "blocked",
};

/** The default for a given (block type, field), or undefined when there is none. */
export function defaultFor(
  type: string,
  field: string,
): string | number | undefined {
  if (field === "status") return STATUS_DEFAULTS[type];
  if (field === "join" && type === "parallel") return "all";
  if (field === "level" && type === "signal") return "info";
  if (type === "toc") {
    if (field === "depth") return 2;
    if (field === "title") return "Contents";
  }
  return undefined;
}

/** Effective value of one field — the authored value, else the type default. */
export function effectiveField(
  block: BlockLike,
  field: string,
): string | number | undefined {
  const v = block.properties?.[field];
  if (v != null) return v;
  // `at:` is a deprecated alias for `src:` on image — interpret without rewriting.
  if (field === "src" && block.type === "image" && block.properties?.at != null) {
    return block.properties.at;
  }
  return defaultFor(block.type, field);
}

/**
 * A block's EFFECTIVE properties — authored values plus its type defaults applied.
 * Use this wherever a document is *interpreted*; never mutate `block.properties`
 * (doing so would change the bytes and break a seal).
 */
export function effectiveProperties(
  block: IntentBlock,
): Record<string, string | number> {
  const props: Record<string, string | number> = { ...(block.properties ?? {}) };
  for (const field of ["status", "join", "level", "depth", "title"]) {
    if (props[field] == null) {
      const d = defaultFor(block.type, field);
      if (d != null) props[field] = d;
    }
  }
  if (block.type === "image" && props.src == null && props.at != null) {
    props.src = props.at;
  }
  return props;
}
