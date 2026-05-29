import React from "react";
import CodeBlock from "@theme/CodeBlock";

interface LiveExampleProps {
  source: string;
  theme?: string;
  showSource?: boolean;
  layout?: "split" | "stacked";
}

export default function LiveExample({
  source,
  showSource = true,
  layout = "split",
}: LiveExampleProps): React.ReactElement {
  const lines = source.trim().split("\n");

  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return (
        <div key={idx} style={{ color: "#6b7280", fontStyle: "italic" }}>
          {trimmed}
        </div>
      );
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      if (trimmed === "---") {
        return (
          <hr
            key={idx}
            style={{ margin: "0.5rem 0", borderColor: "#e5e7eb" }}
          />
        );
      }
      return <div key={idx}>{trimmed}</div>;
    }

    const keyword = trimmed.substring(0, colonIdx);
    const rest = trimmed.substring(colonIdx + 1).trim();

    const parts = rest
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    const content = parts[0] || "";
    const props = parts.slice(1);

    switch (keyword) {
      case "title":
        return (
          <h2
            key={idx}
            style={{ margin: "0 0 0.25rem 0", fontSize: "1.25rem" }}
          >
            {content}
          </h2>
        );
      case "summary":
        return (
          <p
            key={idx}
            style={{
              color: "#6b7280",
              margin: "0 0 0.75rem 0",
              fontStyle: "italic",
            }}
          >
            {content}
          </p>
        );
      case "meta":
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              margin: "0 0 0.5rem 0",
            }}
          >
            {props.map((p, i) => (
              <span key={i} style={{ marginRight: "1rem" }}>
                {p}
              </span>
            ))}
          </div>
        );
      case "section":
        return (
          <h3
            key={idx}
            style={{
              margin: "1rem 0 0.25rem 0",
              fontSize: "1.1rem",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "0.25rem",
            }}
          >
            {content}
          </h3>
        );
      case "note":
        return (
          <p key={idx} style={{ margin: "0.25rem 0" }}>
            {content}
          </p>
        );
      case "contact": {
        const propMap: Record<string, string> = {};
        props.forEach((p) => {
          const [k, ...v] = p.split(":");
          if (k && v.length) propMap[k.trim()] = v.join(":").trim();
        });
        return (
          <div
            key={idx}
            style={{
              padding: "0.5rem",
              margin: "0.25rem 0",
              background: "#f9fafb",
              borderRadius: "4px",
              fontSize: "0.9rem",
            }}
          >
            <strong>{content}</strong>
            {propMap.role && (
              <span style={{ color: "#6b7280" }}> — {propMap.role}</span>
            )}
            {propMap.org && (
              <span style={{ color: "#6b7280" }}> at {propMap.org}</span>
            )}
            {propMap.email && (
              <div style={{ fontSize: "0.8rem", color: "#3b82f6" }}>
                {propMap.email}
              </div>
            )}
          </div>
        );
      }
      case "deadline": {
        const propMap: Record<string, string> = {};
        props.forEach((p) => {
          const [k, ...v] = p.split(":");
          if (k && v.length) propMap[k.trim()] = v.join(":").trim();
        });
        return (
          <div
            key={idx}
            style={{
              padding: "0.5rem",
              margin: "0.25rem 0",
              background: "#fef3c7",
              borderLeft: "3px solid #f59e0b",
              borderRadius: "0 4px 4px 0",
              fontSize: "0.9rem",
            }}
          >
            ⏰ <strong>{content}</strong>
            {propMap.date && (
              <span style={{ color: "#92400e" }}> — {propMap.date}</span>
            )}
          </div>
        );
      }
      case "track":
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
              background: "#f1f5f9",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              margin: "0.25rem 0",
            }}
          >
            📋 Tracked{" "}
            {props.map((p, i) => (
              <span key={i} style={{ marginLeft: "0.5rem" }}>
                {p}
              </span>
            ))}
          </div>
        );
      case "approve":
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.85rem",
              color: "#16a34a",
              margin: "0.25rem 0",
            }}
          >
            ✅ {content}{" "}
            {props.map((p, i) => (
              <span key={i} style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                {p}
              </span>
            ))}
          </div>
        );
      case "sign":
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.85rem",
              color: "#2563eb",
              margin: "0.25rem 0",
            }}
          >
            🔏 Signed by {content}{" "}
            {props.map((p, i) => (
              <span key={i} style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                {p}
              </span>
            ))}
          </div>
        );
      case "freeze":
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.85rem",
              color: "#dc2626",
              margin: "0.25rem 0",
              fontWeight: 600,
            }}
          >
            🔒 Document sealed{" "}
            {props.map((p, i) => (
              <span
                key={i}
                style={{
                  color: "#6b7280",
                  marginLeft: "0.5rem",
                  fontWeight: "normal",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        );
      default:
        return (
          <div key={idx} style={{ margin: "0.25rem 0" }}>
            <strong>{keyword}:</strong> {content}
          </div>
        );
    }
  };

  if (layout === "stacked") {
    return (
      <div style={{ margin: "1.5rem 0" }}>
        {showSource && (
          <CodeBlock language="intenttext">{source.trim()}</CodeBlock>
        )}
        <div
          style={{
            padding: "1.25rem",
            border: "1px solid var(--ifm-color-emphasis-300)",
            borderRadius: "0 0 8px 8px",
            marginTop: showSource ? "-0.5rem" : 0,
          }}
        >
          {lines.map(renderLine)}
        </div>
      </div>
    );
  }

  return (
    <div className="live-example">
      {showSource && (
        <div className="live-source">
          <CodeBlock language="intenttext">{source.trim()}</CodeBlock>
        </div>
      )}
      <div className="live-render">{lines.map(renderLine)}</div>
    </div>
  );
}
