import { useState } from "react";
import { card, labelS, inputS } from "../lib/ui";
import { Toast, useToast } from "../components/Shared";
import { createSite, deleteSite, inviteStaff, updateStaff, deleteStaff } from "../lib/api";
import { APP_PUBLIC_URL } from "../lib/supabaseClient";

const DEFAULT_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#db2777", "#65a30d"];

export default function SettingsPanel({ org, sites, staff, profile, onRefresh }) {
  const [msg, clr, show] = useToast();
  const [siteForm, setSiteForm] = useState({ name: "", color: DEFAULT_COLORS[sites.length % DEFAULT_COLORS.length] });
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "staff", lead: "" });
  const [copiedId, setCopiedId] = useState(null);

  async function addSite() {
    if (!siteForm.name.trim()) return;
    try {
      await createSite({ name: siteForm.name.trim(), color: siteForm.color });
      setSiteForm({ name: "", color: DEFAULT_COLORS[(sites.length + 1) % DEFAULT_COLORS.length] });
      show("✅ Site added!", "#059669");
      onRefresh();
    } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  async function removeSite(id) {
    try { await deleteSite(id); onRefresh(); } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  async function sendInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    try {
      await inviteStaff({ name: inviteForm.name.trim(), email: inviteForm.email.trim(), role: inviteForm.role, lead: inviteForm.lead.trim() || null });
      setInviteForm({ name: "", email: "", role: "staff", lead: "" });
      show("✅ Invite created — copy the link below to send it.", "#059669");
      onRefresh();
    } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  async function changeRole(id, role) {
    try { await updateStaff(id, { role }); onRefresh(); } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  async function removeStaff(id) {
    try { await deleteStaff(id); onRefresh(); } catch (e) { show("❌ " + e.message, "#dc2626"); }
  }

  function copyInvite(u) {
    const link = `${APP_PUBLIC_URL}/#invite/${u.invite_token}`;
    navigator.clipboard.writeText(link).then(() => { setCopiedId(u.id); setTimeout(() => setCopiedId(null), 2500); });
  }

  return (
    <div>
      <Toast msg={msg} color={clr} />
      <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#1e3a5f" }}>Settings</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0, marginBottom: 24 }}>{org.name} · {staff.length} staff · {sites.length} sites</p>

      <div style={{ ...card }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f", marginBottom: 12 }}>🏥 Sites</div>
        {sites.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 14, height: 14, borderRadius: 4, background: s.color }} /><span style={{ fontWeight: 600 }}>{s.name}</span></div>
            <button onClick={() => removeSite(s.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>Remove</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelS}>Site name<input type="text" placeholder="e.g. Burlington" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Color<input type="color" value={siteForm.color} onChange={e => setSiteForm(f => ({ ...f, color: e.target.value }))} style={{ ...inputS, padding: 2, width: 60 }} /></label>
          <button onClick={addSite} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Add Site</button>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f", marginBottom: 12 }}>👥 Staff</div>
        {staff.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{u.name}</span>
              <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 8 }}>{u.email}</span>
              {!u.auth_user_id && <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginLeft: 8 }}>PENDING INVITE</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} disabled={u.id === profile.id} style={{ ...inputS, width: "auto", padding: "4px 8px", fontSize: 12 }}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              {!u.auth_user_id && <button onClick={() => copyInvite(u)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: copiedId === u.id ? "#059669" : "#fff", color: copiedId === u.id ? "#fff" : "#374151", cursor: "pointer", fontSize: 12 }}>{copiedId === u.id ? "✓ Copied" : "🔗 Copy invite link"}</button>}
              {u.id !== profile.id && <button onClick={() => removeStaff(u.id)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>Remove</button>}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelS}>Name<input type="text" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Email<input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} style={inputS} /></label>
          <label style={labelS}>Role<select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} style={inputS}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
          <label style={labelS}>Lead (optional)<input type="text" value={inviteForm.lead} onChange={e => setInviteForm(f => ({ ...f, lead: e.target.value }))} style={inputS} /></label>
          <button onClick={sendInvite} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#0369a1", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Create Invite</button>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>Real invite emails aren't wired up yet — copy the link and send it yourself (text, email, Slack). Whoever opens it signs up and joins your clinic automatically.</div>
      </div>
    </div>
  );
}
