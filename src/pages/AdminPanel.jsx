import { useState } from "react";
import { fmt, today } from "../lib/dates";
import { siteColor, card, inputS } from "../lib/ui";
import { Toast, useToast } from "../components/Shared";
import { deleteShift } from "../lib/api";

// The Add Shift form used to live here — it's now its own top-level tab
// (src/pages/AddShift.jsx) since it was easy to miss buried below the
// stat cards. This page stays focused on the stats + filterable shift list.
export default function AdminPanel({ shifts, sites, staff, onRefresh }) {
  const [msg, clr, show] = useToast();
  const [fSite, setFSite] = useState("All");
  const [fStaff, setFStaff] = useState("All");

  async function removeShift(id) {
    try { await deleteShift(id); onRefresh(); } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  const openCount = shifts.filter(s => s.status === "open" && s.date >= fmt(today)).length;
  const visible = shifts
    .filter(s => fSite === "All" || s.site_id === fSite)
    .filter(s => fStaff === "All" || s.staff_id === fStaff)
    .filter(s => s.date >= fmt(today))
    .slice(0, 40);

  return (
    <div>
      <Toast msg={msg} color={clr} />
      <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#1e3a5f" }}>Admin — Manage Shifts</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Open shifts", val: openCount, color: "#ef4444" },
          { label: "Upcoming", val: shifts.filter(s => s.date >= fmt(today)).length, color: "#2563eb" },
          { label: "Staff", val: staff.length, color: "#059669" },
          { label: "Total shifts", val: shifts.length, color: "#7c3aed" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={fStaff} onChange={e => setFStaff(e.target.value)} style={{ ...inputS, width: "auto" }}><option value="All">All Staff</option>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select value={fSite} onChange={e => setFSite(e.target.value)} style={{ ...inputS, width: "auto" }}><option value="All">All Sites</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {visible.map((s, i) => (
        <div key={i} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: siteColor(s.site), flexShrink: 0 }} />
            <div><span style={{ fontWeight: 600, color: "#1e3a5f" }}>{s.staff?.name || (s.status !== "assigned" ? "Unassigned" : "Unknown")}</span><span style={{ color: "#6b7280", fontSize: 13 }}> · {s.site?.name} · {s.date} · {s.start_time}–{s.end_time}</span>{s.status !== "assigned" && <span style={{ color: "#d97706", fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{s.status.toUpperCase()}</span>}{s.notes && <span style={{ color: "#9ca3af", fontSize: 12 }}> · {s.notes}</span>}</div>
          </div>
          <button onClick={() => removeShift(s.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
      ))}
    </div>
  );
}
