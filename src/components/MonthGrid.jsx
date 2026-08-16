import { MONTHS, DAYS, fmt, today } from "../lib/dates";
import { siteColor } from "../lib/ui";
import { CalNav } from "./Shared";

// Generic month grid — accepts shifts (joined with .site) and an optional
// renderCell function for flexibility. Unchanged from the original prototype
// apart from reading `.site` (a joined row) instead of a bare site string.
export default function MonthGrid({ monthDate, setMonthDate, shifts, renderCell, showNames = false }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => fmt(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = fmt(today);

  return (
    <div>
      <CalNav
        label={`${MONTHS[month]} ${year}`}
        onPrev={() => setMonthDate(new Date(year, month - 1, 1))}
        onNext={() => setMonthDate(new Date(year, month + 1, 1))}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", padding: "6px 0", background: "#f8fafc", borderRadius: 4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} style={{ minHeight: 80, background: "#f9fafb", borderRadius: 6, opacity: 0.3 }} />;
          const isToday = dateStr === todayStr;
          const dayNum = parseInt(dateStr.split("-")[2]);
          const dayShifts = shifts.filter(s => s.date === dateStr);
          return (
            <div key={dateStr} style={{ minHeight: 80, borderRadius: 6, padding: 4, background: isToday ? "#eff6ff" : "#fff", border: `1px solid ${isToday ? "#3b82f6" : "#e5e7eb"}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#2563eb" : "#374151", marginBottom: 3, textAlign: "right", paddingRight: 2 }}>{dayNum}</div>
              {renderCell ? renderCell(dateStr, dayShifts) : dayShifts.slice(0, 3).map((s, j) => (
                <div key={j} style={{ background: siteColor(s.site), borderRadius: 3, color: "#fff", padding: "2px 5px", fontSize: 10, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {showNames ? (s.staff?.name || "?") : s.site?.name}
                </div>
              ))}
              {dayShifts.length > 3 && <div style={{ fontSize: 9, color: "#9ca3af", paddingLeft: 2 }}>+{dayShifts.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
