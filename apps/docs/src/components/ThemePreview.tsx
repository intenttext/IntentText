import React from "react";

interface ThemePreviewProps {
  themes?: string[];
  source?: string;
}

const THEME_COLORS: Record<
  string,
  { bg: string; text: string; accent: string; heading: string }
> = {
  corporate: {
    bg: "#ffffff",
    text: "#1a1a2e",
    accent: "#2563eb",
    heading: "#1a1a2e",
  },
  minimal: {
    bg: "#fafafa",
    text: "#333333",
    accent: "#333333",
    heading: "#111111",
  },
  warm: {
    bg: "#fdf8f0",
    text: "#3d2b1f",
    accent: "#c17f59",
    heading: "#2d1b0e",
  },
  technical: {
    bg: "#f8f9fa",
    text: "#212529",
    accent: "#0d6efd",
    heading: "#212529",
  },
  print: {
    bg: "#ffffff",
    text: "#000000",
    accent: "#000000",
    heading: "#000000",
  },
  legal: {
    bg: "#ffffff",
    text: "#1a1a1a",
    accent: "#1a365d",
    heading: "#1a365d",
  },
  editorial: {
    bg: "#fffff8",
    text: "#333333",
    accent: "#8b0000",
    heading: "#1a1a1a",
  },
  dark: {
    bg: "#1a1a2e",
    text: "#e4e4e7",
    accent: "#60a5fa",
    heading: "#f4f4f5",
  },
};

export default function ThemePreview({
  themes = ["corporate", "minimal", "warm", "editorial"],
  source,
}: ThemePreviewProps): React.ReactElement {
  const sampleTitle = "Service Agreement";
  const sampleContent =
    source || "Consulting services for Q2 2026. Value: USD 24,000.";

  return (
    <div className="theme-preview-grid">
      {themes.map((theme) => {
        const colors = THEME_COLORS[theme] || THEME_COLORS.corporate;
        return (
          <div key={theme} className="theme-preview-card">
            <header>{theme}</header>
            <div
              className="preview-content"
              style={{
                background: colors.bg,
                color: colors.text,
                fontFamily:
                  theme === "editorial"
                    ? "Georgia, serif"
                    : "system-ui, sans-serif",
              }}
            >
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: colors.heading,
                  marginBottom: "0.5rem",
                  borderBottom:
                    theme === "legal" ? "2px solid " + colors.accent : "none",
                  paddingBottom: "0.25rem",
                }}
              >
                {sampleTitle}
              </div>
              <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
                {sampleContent}
              </div>
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.7rem",
                  color: colors.accent,
                  fontWeight: 600,
                }}
              >
                ✅ Approved by Legal
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
