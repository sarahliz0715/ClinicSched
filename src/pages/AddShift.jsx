import { useState } from "react";
import { fmt, today, formatDate } from "../lib/dates";
import { siteColor, card, labelS, inputS } from "../lib/ui";
import { Toast, useToast } from "../components/Shared";
import { createShift } from "../lib/api";

// Its own top-level tab (admin-only) instead of living inside Admin, below
// the stat cards — this is meant to be the fast, one-click path for the
// thing admins do most often, not something to scroll down to find.
export default function AddShift({ sites, staff, shifts, onRefresh }) {
  const [form, setForm] = useState({ staffId: staff[0]?.id || "", site_id: sites[0]?.id || "", date: fmt(today), start_time: "07:00", end_time: "15:00", notes: "" });
  const [msg, clr, show] = useToast();
  const [busy, setBusy] = useState(false);

  async function addShift() {
    if (!form.staffId || !form.site_id || !form.date) return;
    setBusy(true);
    try {
      await createShift({ staff_id: form.staffId, site_id: form.site_id, date: form.date, start_time: form.start_time, end_time: form.end_time, notes: form.notes, status: "assigned" });
      show("✅ Shift added!", "#059669");
      setForm(f => ({ ...f, notes: "" }));
      onRefresh();
    } catch (e) {
      show("❌ " + e.message, "#dc2626");
    } finally {
      setBusy(false);
    }
  }

  const justAdded = shifts
    .filter(s => s.date >= fmt(today))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 5);

  if (!sites.length || !staff.length) {
    return (
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#1e3a5f" }}>Add Shift</h2>
        <div style={{ ...card, textAlign: "center", color: "#9ca3af", padding: 40 }}>
          {!sites.length ? "Add a site first (Settings → Sites)." : "Add or invite staff first (Settings → Staff)."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toast msg={msg} color={clr} />
      <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#1e3a5f" }}>Add Shift</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0, marginBottom: 20 }}>Schedule one staff member for one shift.</p>

      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          <label style={labelS}>Staff<select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} style={inputS}>{staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label style={labelS}>Site<select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={inputS}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label style={labelS}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Start<input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>End<input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Notes<input type="text" placeholder="optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputS} /></label>
        </div>
        <button onClick={addShift} disabled={busy} style={{ marginTop: 14, padding: "10px 24px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: busy ? 0.7 : 1 }}>{busy ? "Adding…" : "➕ Add Shift"}</button>
      </div>

      {justAdded.length > 0 && (
        <>
          <h3 style={{ marginTop: 4, marginBottom: 12, color: "#1e3a5f", fontSize: 16 }}>Recently Added / Upcoming</h3>
          {justAdded.map((s, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: siteColor(s.site), flexShrink: 0 }} />
              <div><span style={{ fontWeight: 600, color: "#1e3a5f" }}>{s.staff?.name || "Unassigned"}</span><span style={{ color: "#6b7280", fontSize: 13 }}> · {s.site?.name} · {formatDate(s.date)} · {s.start_time}–{s.end_time}</span></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
