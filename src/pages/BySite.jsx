import { useState } from "react";
import { fmt, addDays, today, formatDate } from "../lib/dates";
import { siteColor } from "../lib/ui";
import { ViewToggle, CalNav } from "../components/Shared";
import MonthGrid from "../components/MonthGrid";

export default function BySite({ shifts, sites, staff }) {
  const [sel, setSel] = useState(sites[0]?.id || "");
  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d; });
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const selectedSite = sites.find(s => s.id === sel);
  const weekDays = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStart, i)));
  const siteShifts = shifts.filter(s => s.site_id === sel);

  function renderMonthCell(dateStr, dayShifts) {
    return dayShifts.map((s, j) => (
      <div key={j} style={{ background: "#1e3a5f", borderRadius: 3, color: "#fff", padding: "2px 5px", fontSize: 10, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.staff?.name || "?"}</div>
    ));
  }

  if (!sites.length) {
    return <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>No sites yet — add one in Settings.</div>;
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#1e3a5f" }}>By Site</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {sites.map(site => (
          <button key={site.id} onClick={() => setSel(site.id)} style={{ padding: "7px 16px", borderRadius: 20, border: "2px solid", borderColor: sel === site.id ? siteColor(site) : "#e5e7eb", background: sel === site.id ? siteColor(site) : "#fff", color: sel === site.id ? "#fff" : "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{site.name}</button>
        ))}
      </div>

      <ViewToggle view={view} setView={setView} />

      {view === "week" ? (
        <>
          <CalNav label={`Week of ${formatDate(fmt(weekStart))}`} onPrev={() => setWeekStart(addDays(weekStart, -7))} onNext={() => setWeekStart(addDays(weekStart, 7))} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
            {weekDays.map(date => {
              const dayShifts = siteShifts.filter(s => s.date === date);
              const isToday = date === fmt(today);
              return (
                <div key={date} style={{ background: isToday ? "#eff6ff" : "#f9fafb", border: `1px solid ${isToday ? "#3b82f6" : "#e5e7eb"}`, borderRadius: 10, padding: 10, minHeight: 90 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#3b82f6" : "#6b7280", marginBottom: 6 }}>{formatDate(date)}</div>
                  {dayShifts.length === 0 ? <div style={{ fontSize: 11, color: "#d1d5db" }}>No staff</div>
                    : dayShifts.map((s, i) => <div key={i} style={{ background: "#1e3a5f", borderRadius: 6, color: "#fff", padding: "4px 7px", fontSize: 11, marginBottom: 3 }}>{s.staff?.name || s._importName || "?"}<br /><span style={{ fontSize: 10, opacity: 0.75 }}>{s.start_time}–{s.end_time}</span></div>)}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <MonthGrid monthDate={monthDate} setMonthDate={setMonthDate} shifts={siteShifts} renderCell={renderMonthCell} />
      )}

      <div style={{ marginTop: 20, background: "#fef3c7", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>📞 Who's off today — available to call for {selectedSite?.name}?</div>
        {staff.filter(u => !shifts.some(s => s.date === fmt(today) && s.staff_id === u.id)).map(u => <div key={u.id} style={{ fontSize: 13, color: "#78350f", marginBottom: 4 }}>✓ {u.name} — off today</div>)}
      </div>
    </div>
  );
}
