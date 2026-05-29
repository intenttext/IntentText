import type { DeadlineEntry } from "../hooks/useWorkspace";

interface DeadlinesPanelProps {
  deadlines: DeadlineEntry[];
  onFileOpen: (path: string) => void;
}

function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyIcon(days: number): string {
  if (days < 0) return "⚫";
  if (days < 7) return "🔴";
  if (days < 30) return "🟡";
  return "🟢";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface GroupedDeadline {
  month: string;
  items: (DeadlineEntry & { date: Date; days: number })[];
}

export function DeadlinesPanel({ deadlines, onFileOpen }: DeadlinesPanelProps) {
  // Parse and sort deadlines
  const parsed = deadlines
    .map((d) => {
      const date = parseDateString(d.date);
      if (!date) return null;
      return { ...d, date, days: daysUntil(date) };
    })
    .filter(
      (d): d is DeadlineEntry & { date: Date; days: number } => d !== null,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by month
  const groups: GroupedDeadline[] = [];
  for (const item of parsed) {
    const monthKey = item.date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    let group = groups.find((g) => g.month === monthKey);
    if (!group) {
      group = { month: monthKey, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  if (deadlines.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>No deadlines found</p>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Add deadline: blocks to your .it files
        </p>
      </div>
    );
  }

  return (
    <div className="deadlines-panel">
      {groups.map((group) => (
        <div key={group.month} className="deadline-month">
          <div className="deadline-month-header">{group.month}</div>
          {group.items.map((item, i) => (
            <div
              key={i}
              className="deadline-item"
              onClick={() => onFileOpen(item.file)}
            >
              <span className="deadline-urgency">{urgencyIcon(item.days)}</span>
              <div className="deadline-info">
                <div className="deadline-label">{item.label}</div>
                <div className="deadline-meta">
                  {formatDate(item.date)} — {item.relative_path}
                  {item.days >= 0 && (
                    <span className="deadline-days">
                      {" "}
                      ({item.days} day{item.days !== 1 ? "s" : ""})
                    </span>
                  )}
                  {item.days < 0 && (
                    <span className="deadline-overdue"> (overdue)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
