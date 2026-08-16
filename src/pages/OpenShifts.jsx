import { useState } from "react";
import { fmt, addDays, today, formatDate } from "../lib/dates";
import { siteColor, card, labelS, inputS } from "../lib/ui";
import { buildGCalUrl } from "../lib/calendar";
import { Toast, useToast, SiteBadge } from "../components/Shared";
import { createShift, deleteShift, claimShiftForSelf, notifyStaffOfOpenShift } from "../lib/api";
import { APP_PUBLIC_URL } from "../lib/supabaseClient";

export default function OpenShifts({ profile, isAdmin, gcalConnected, shifts, sites, org, onRefresh }) {
  const [form, setForm] = useState({ site_id: sites[0]?.id || "", date: fmt(addDays(today, 1)), start_time: "07:00", end_time: "15:00", notes: "" });
  const [msg, clr, show] = useToast();
  const [posting, setPosting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const publicLink = `${APP_PUBLIC_URL}/#open/${org.public_share_token}`;

  async function postOpen() {
    if (!form.site_id) { show("Add a site first (Settings → Sites).", "#dc2626"); return; }
    setPosting(true);
    try {
      const shift = await createShift({ ...form, status: "open" });
      setForm(f => ({ ...f, notes: "" }));
      let sent = false;
      try { await notifyStaffOfOpenShift(shift.id); sent = true; } catch { /* email not set up yet */ }
      show(sent ? "✅ Open shift posted! Staff notified by email." : "✅ Open shift posted! (Email notifications need Resend setup.)", "#059669");
      onRefresh();
    } catch (e) {
      show("❌ " + e.message, "#dc2626");
    } finally {
      setPosting(false);
    }
  }

  function copyLink() { navigator.clipboard.writeText(publicLink).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }); }

  async function claimShift(os) {
    try {
      const claimed = await claimShiftForSelf(os.id, profile.id);
      if (gcalConnected) window.open(buildGCalUrl(claimed, claimed.site?.name, profile.name), "_blank");
      show(`✅ Claimed! ${os.site?.name} on ${formatDate(os.date)} added to your schedule.`, "#059669");
      onRefresh();
    } catch (e) {
      show("❌ " + e.message, "#dc2626");
    }
  }

  async function removeOpen(id) {
    try { await deleteShift(id); onRefresh(); } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  const available = shifts.filter(s => s.status === "open" && s.date >= fmt(today));

  return (
    <div>
      <Toast msg={msg} color={clr} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1e3a5f" }}>Open Shifts</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {available.length > 0 && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 700 }}>{available.length} open</div>}
          <button onClick={copyLink} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: linkCopied ? "#059669" : "#fff", color: linkCopied ? "#fff" : "#374151", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
            {linkCopied ? "✓ Link Copied!" : "🔗 Copy Shareable Link"}
          </button>
        </div>
      </div>
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 6, fontSize: 14 }}>📱 Share like Sign Up Genius</div>
        <div style={{ fontSize: 13, color: "#0369a1", marginBottom: 10 }}>Hit <strong>Copy Shareable Link</strong> and text it — staff click it, see your clinic's open shifts, and claim one without needing to log in.</div>
        <div style={{ background: "#e0f2fe", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#0369a1", wordBreak: "break-all" }}>{publicLink}</div>
      </div>
      {isAdmin && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: "#0369a1" }}>📢 Post an Open Shift</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
            <label style={labelS}>Site<select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={inputS}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label style={labelS}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputS} /></label>
            <label style={labelS}>Start<input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputS} /></label>
            <label style={labelS}>End<input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={inputS} /></label>
            <label style={labelS}>Notes<input type="text" placeholder="e.g. MRI experience needed" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputS} /></label>
          </div>
          <button onClick={postOpen} disabled={posting} style={{ marginTop: 14, padding: "10px 24px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: posting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8 }}>{posting ? "Posting…" : "📢 Post & Notify Staff"}</button>
        </div>
      )}
      {available.length === 0
        ? <div style={{ ...card, textAlign: "center", color: "#9ca3af", padding: 40 }}>🎉 No open shifts right now!</div>
        : <>
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>👋 Hit <strong>Claim Shift</strong> to add it to your schedule{gcalConnected ? " and Google Calendar" : ""} instantly.</div>
          {available.map(s => {
            const conflict = shifts.some(ms => ms.staff_id === profile.id && ms.date === s.date);
            return (
              <div key={s.id} style={{ ...card, borderLeft: `4px solid ${siteColor(s.site)}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 6 }}><SiteBadge site={s.site} /><span style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 15 }}>{formatDate(s.date)}</span></div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>🕐 {s.start_time} – {s.end_time}</div>
                  {s.notes && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 3 }}>📋 {s.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {isAdmin
                    ? <button onClick={() => removeOpen(s.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>Remove</button>
                    : conflict ? <span style={{ fontSize: 12, color: "#9ca3af" }}>You already have a shift this day</span>
                      : <button onClick={() => claimShift(s)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>✋ Claim Shift {gcalConnected && <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{ width: 14, height: 14 }} />}</button>
                  }
                </div>
              </div>
            );
          })}
        </>
      }
    </div>
  );
}
