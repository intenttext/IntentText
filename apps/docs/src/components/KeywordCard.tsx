import React from "react";

interface KeywordCardProps {
  name: string;
  category:
    | "Identity"
    | "Content"
    | "Structure"
    | "Data"
    | "Agent"
    | "Trust"
    | "Layout";
  since: string;
  aliases?: string[];
  description: string;
}

export default function KeywordCard({
  name,
  category,
  since,
  aliases,
  description,
}: KeywordCardProps): React.ReactElement {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        border: "1px solid var(--ifm-color-emphasis-200)",
        borderRadius: "8px",
        background: "var(--ifm-background-surface-color)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        <code style={{ fontSize: "1.1rem", fontWeight: 700 }}>{name}:</code>
        <span
          className={`keyword-badge keyword-badge--${category.toLowerCase()}`}
        >
          {category}
        </span>
        <span
          style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)" }}
        >
          Since {since}
        </span>
      </div>
      {aliases && aliases.length > 0 && (
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--ifm-color-emphasis-600)",
            marginBottom: "0.5rem",
          }}
        >
          Aliases:{" "}
          {aliases.map((a, i) => (
            <span key={a}>
              <code>{a}:</code>
              {i < aliases.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}
      <p style={{ margin: 0 }}>{description}</p>
    </div>
  );
}
