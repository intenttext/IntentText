import { LANGUAGE_REGISTRY } from "@intenttext/core";
import { CATEGORY_META, READ_ONLY_KEYWORDS } from "../types";

interface Props {
  keyword: string;
}

// Floating keyword label that appears on hover / when selected
export function BlockTag({ keyword }: Props) {
  const reg = LANGUAGE_REGISTRY.find((r) => r.canonical === keyword);
  const cat = reg ? CATEGORY_META[reg.category] : null;

  return (
    <span
      className="it-block-tag"
      title={reg?.description || keyword}
      style={{
        borderColor: cat?.color ? `${cat.color}40` : undefined,
        color: cat?.color || undefined,
      }}
    >
      {cat?.icon} {keyword}
      {READ_ONLY_KEYWORDS.has(keyword) && " (locked)"}
    </span>
  );
}
