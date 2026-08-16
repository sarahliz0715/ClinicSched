import { useMemo, useState } from "react";
import { fmt, addDays, today, formatDate } from "../lib/dates";
import { siteColor, card } from "../lib/ui";
import { exportICS } from "../lib/calendar";
import { ViewToggle, CalNav, SiteBadge, AddToCalBtn } from "../components/Shared";
import MonthGrid from "../components/MonthGrid";

export default function MySchedule({ profile, gcalConnected, shifts }) {
  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d; });
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const myShifts = useMemo(() => shifts.filter(s => s.staff_id === profile.id).sort((a, b) => a.date.localeCompare(b.date)), [shifts, profile.id]);
  const weekDays = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStart, i)));

  function renderMonthCell(dateStr, dayShifts) {
    return dayShifts.map((s, j) => (
      <div key={j} style={{ background: siteColor(s.site), borderRadius: 3, color: "#fff", padding: "2px 5px", fontSize: 10, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {s.site?.name} {s.start_time}
      </div>
    ));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a5f" }}>My Schedule</h2>
        <button onClick={() => exportICS(myShifts, profile.name)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontSize: 13 }}>⬇ Download All (.ics)</button>
      </div>

      <ViewToggle view={view} setView={setView} />

      {view === "week" ? (
        <>
          <CalNav label={`Week of ${formatDate(fmt(weekStart))}`} onPrev={() => setWeekStart(addDays(weekStart, -7))} onNext={() => setWeekStart(addDays(weekStart, 7))} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 28 }}>
            {weekDays.map(date => {
              const dayShifts = myShifts.filter(s => s.date === date);
              const isToday = date === fmt(today);
              return (
                <div key={date} style={{ background: isToday ? "#eff6ff" : "#f9fafb", border: `1px solid ${isToday ? "#3b82f6" : "#e5e7eb"}`, borderRadius: 10, padding: 10, minHeight: 80 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "#3b82f6" : "#6b7280", marginBottom: 6 }}>{formatDate(date)}</div>
                  {dayShifts.length === 0 ? <div style={{ fontSize: 11, color: "#d1d5db" }}>Off</div>
                    : dayShifts.map(s => <div key={s.id} style={{ background: siteColor(s.site), borderRadius: 6, color: "#fff", padding: "4px 7px", fontSize: 11, marginBottom: 3 }}>{s.site?.name}<br /><span style={{ fontSize: 10, opacity: 0.85 }}>{s.start_time}–{s.end_time}</span></div>)}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <MonthGrid monthDate={monthDate} setMonthDate={setMonthDate} shifts={myShifts} renderCell={renderMonthCell} />
        </div>
      )}

      <h3 style={{ marginTop: 4, marginBottom: 12, color: "#1e3a5f", fontSize: 16 }}>Upcoming Shifts</h3>
      {myShifts.filter(s => s.date >= fmt(today)).slice(0, 10).map((s, i) => (
        <div key={i} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <SiteBadge site={s.site} />
            <div><div style={{ fontWeight: 600, color: "#1e3a5f" }}>{formatDate(s.date)}</div><div style={{ fontSize: 13, color: "#6b7280" }}>{s.start_time} – {s.end_time}</div>{s.notes && <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.notes}</div>}</div>
          </div>
          <AddToCalBtn shift={s} userName={profile.name} gcalConnected={gcalConnected} />
        </div>
      ))}
    </div>
  );
}
