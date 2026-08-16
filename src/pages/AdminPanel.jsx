import { useState } from "react";
import { fmt, today } from "../lib/dates";
import { siteColor, card, labelS, inputS } from "../lib/ui";
import { Toast, useToast } from "../components/Shared";
import { createShift, deleteShift } from "../lib/api";

export default function AdminPanel({ shifts, sites, staff, onRefresh }) {
  const [form, setForm] = useState({ staffId: staff[0]?.id || "", site_id: sites[0]?.id || "", date: fmt(today), start_time: "07:00", end_time: "15:00", notes: "" });
  const [msg, clr, show] = useToast();
  const [fSite, setFSite] = useState("All");
  const [fStaff, setFStaff] = useState("All");

  async function addShift() {
    if (!form.staffId || !form.site_id || !form.date) return;
    try {
      await createShift({ staff_id: form.staffId, site_id: form.site_id, date: form.date, start_time: form.start_time, end_time: form.end_time, notes: form.notes, status: "assigned" });
      show("✅ Shift added!", "#059669");
      setForm(f => ({ ...f, notes: "" }));
      onRefresh();
    } catch (e) {
      show("❌ " + e.message, "#dc2626");
    }
  }

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
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, color: "#0369a1" }}>➕ Add Shift</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          <label style={labelS}>Staff<select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} style={inputS}>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label style={labelS}>Site<select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={inputS}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label style={labelS}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Start<input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>End<input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Notes<input type="text" placeholder="optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputS} /></label>
        </div>
        <button onClick={addShift} style={{ marginTop: 14, padding: "10px 24px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Add Shift</button>
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
