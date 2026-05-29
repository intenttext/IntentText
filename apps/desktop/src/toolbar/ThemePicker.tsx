import { listBuiltinThemes } from "@intenttext/core";

interface Props {
  active: string;
  onSelect: (theme: string) => void;
}

export function ThemePicker({ active, onSelect }: Props) {
  const themes = listBuiltinThemes();

  return (
    <div className="dropdown-menu">
      {themes.map((t) => (
        <button
          key={t}
          className={`dropdown-item ${t === active ? "active" : ""}`}
          onClick={() => onSelect(t)}
        >
          {t === active ? "●" : "○"} {t}
        </button>
      ))}
    </div>
  );
}
