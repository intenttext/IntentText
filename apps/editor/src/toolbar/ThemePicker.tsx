import { listBuiltinThemes } from "@intenttext/core";
import type { ReactNode } from "react";

const svg = (d: string) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const THEME_META: Record<string, { icon: ReactNode; desc: string }> = {
  corporate: {
    icon: svg(
      "M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h0M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",
    ),
    desc: "Clean & professional",
  },
  minimal: {
    icon: svg("M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"),
    desc: "Simple & understated",
  },
  warm: {
    icon: svg(
      "M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    ),
    desc: "Inviting earth tones",
  },
  modern: {
    icon: svg(
      "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z",
    ),
    desc: "Bold contemporary",
  },
  academic: {
    icon: svg(
      "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
    ),
    desc: "Scholarly & formal",
  },
  creative: {
    icon: svg(
      "M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20zm0 2a3 3 0 0 0 0 6 3 3 0 0 0 0-6z",
    ),
    desc: "Expressive & vibrant",
  },
  elegant: {
    icon: svg(
      "M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z",
    ),
    desc: "Refined & luxurious",
  },
  technical: {
    icon: svg(
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1.08H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z",
    ),
    desc: "Engineering focus",
  },
};

interface Props {
  active: string;
  onSelect: (theme: string) => void;
}

export function ThemePicker({ active, onSelect }: Props) {
  const themes = listBuiltinThemes() as string[];

  return (
    <div className="dropdown-menu theme-picker-menu">
      <div className="theme-picker-title">Theme</div>
      {themes.map((t) => {
        const fallback = svg(
          "M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z",
        );
        const meta = THEME_META[t] || { icon: fallback, desc: "" };
        return (
          <button
            key={t}
            className={`theme-picker-item ${t === active ? "active" : ""}`}
            onClick={() => onSelect(t)}
          >
            <span className="theme-picker-icon">{meta.icon}</span>
            <span className="theme-picker-label">
              <span className="theme-picker-name">{t}</span>
              {meta.desc && (
                <span className="theme-picker-desc">{meta.desc}</span>
              )}
            </span>
            {t === active && (
              <span className="theme-picker-check">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
