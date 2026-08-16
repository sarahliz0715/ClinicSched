import { useState } from "react";
import { fmt, addDays, today, formatDate } from "../lib/dates";
import { siteColor, thS, tdS } from "../lib/ui";
import { ViewToggle, CalNav } from "../components/Shared";
import MonthGrid from "../components/MonthGrid";

export default function ByLead({ shifts, staff }) {
  const leads = [...new Set(staff.map(u => u.lead).filter(Boolean))];
  const [sel, setSel] = useState(leads[0] || "");
  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d; });
  const [monthDate, setMonthDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const teamStaff = staff.filter(u => u.lead === sel);
  const weekDays = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStart, i)));
  const teamShifts = shifts.filter(s => teamStaff.some(u => u.id === s.staff_id));

  function renderMonthCell(dateStr, dayShifts) {
    return dayShifts.map((s, j) => (
      <div key={j} style={{ background: siteColor(s.site), borderRadius: 3, color: "#fff", padding: "2px 5px", fontSize: 10, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.staff?.name || "?"} · {s.site?.name}</div>
    ));
  }

  if (!leads.length) {
    return <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>No team leads set yet — set a "Lead" on staff in Settings.</div>;
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#1e3a5f" }}>By Lead</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {leads.map(lead => <button key={lead} onClick={() => setSel(lead)} style={{ padding: "7px 16px", borderRadius: 20, border: "2px solid", borderColor: sel === lead ? "#1e3a5f" : "#e5e7eb", background: sel === lead ? "#1e3a5f" : "#fff", color: sel === lead ? "#fff" : "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{lead}'s Team</button>)}
      </div>

      <ViewToggle view={view} setView={setView} />

      {view === "week" ? (
        <>
          <CalNav label={`Week of ${formatDate(fmt(weekStart))}`} onPrev={() => setWeekStart(addDays(weekStart, -7))} onNext={() => setWeekStart(addDays(weekStart, 7))} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead><tr><th style={thS}>Staff</th>{weekDays.map(d => <th key={d} style={{ ...thS, background: d === fmt(today) ? "#dbeafe" : "#f1f5f9" }}>{formatDate(d)}</th>)}</tr></thead>
              <tbody>
                {teamStaff.map(u => (
                  <tr key={u.id}>
                    <td style={tdS}><div style={{ fontWeight: 600, color: "#1e3a5f" }}>{u.name}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email}</div></td>
                    {weekDays.map(date => {
                      const ds = shifts.filter(s => s.staff_id === u.id && s.date === date);
                      return <td key={date} style={{ ...tdS, background: date === fmt(today) ? "#eff6ff" : "transparent" }}>{ds.length === 0 ? <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span> : ds.map((s, i) => <div key={i} style={{ background: siteColor(s.site), borderRadius: 6, color: "#fff", padding: "3px 7px", fontSize: 11, marginBottom: 2, whiteSpace: "nowrap" }}>{s.site?.name}</div>)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <MonthGrid monthDate={monthDate} setMonthDate={setMonthDate} shifts={teamShifts} renderCell={renderMonthCell} />
      )}
    </div>
  );
}
