import { IntentBlock } from "./types";

export function flattenBlocks(blocks: IntentBlock[]): IntentBlock[] {
  const result: IntentBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}
