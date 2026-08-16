import { useEffect, useState } from "react";
import { createOrganization, acceptInvite, signOut, readPendingInvite, clearPendingInvite } from "../lib/api";
import { Spinner, ErrBox } from "../components/Shared";

// Shown for an authenticated user with no `staff` row yet — either a
// brand-new signup (create an organization) or someone who followed a
// staff invite link (link this account to the invite instead).
//
// `inviteToken` comes from the URL hash, but that can be lost — if the
// Supabase project has "Confirm email" enabled, the confirmation-link
// click redirects back without whatever hash was in the URL when signup
// started. readPendingInvite() (src/lib/api.js) is the fallback: Signup.jsx
// snapshots the token to localStorage right before calling signUp() when
// starting from an invite link, so it survives that gap.
export default function OnboardingGate({ inviteToken: hashInviteToken, onDone }) {
  const [inviteToken] = useState(() => hashInviteToken || readPendingInvite());
  const [mode, setMode] = useState(inviteToken ? "accepting" : "form");
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      try {
        await acceptInvite(inviteToken);
        clearPendingInvite();
        // Clears both ?invite= and any #invite/ leftover, not just the hash
        // — a stale query param would otherwise re-trigger invite detection
        // on the next reload.
        window.history.replaceState(null, "", window.location.pathname);
        await onDone();
      } catch (e) {
        setErr(e.message || "That invite link is invalid or already used.");
        setMode("invite-error");
      }
    })();
  }, [inviteToken, onDone]);

  async function submitOrg() {
    if (!orgName.trim() || !adminName.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await createOrganization({ orgName: orgName.trim(), adminName: adminName.trim() });
      clearPendingInvite();
      await onDone();
    } catch (e) {
      setErr(e.message || "Couldn't create your organization.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "accepting") return <Spinner />;

  if (mode === "invite-error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center" }}>
          <ErrBox err={err} />
          <p style={{ color: "#6b7280", fontSize: 14 }}>Ask whoever invited you for a fresh link, or set up your own organization instead.</p>
          <button onClick={() => { clearPendingInvite(); window.history.replaceState(null, "", window.location.pathname); setMode("form"); }} style={{ marginTop: 10, padding: "10px 20px", borderRadius: 8, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Set up a new organization</button>
          <div style={{ marginTop: 14 }}><a href="#" onClick={e => { e.preventDefault(); signOut(); }} style={{ fontSize: 12, color: "#9ca3af" }}>Sign out</a></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e3a5f", fontWeight: 800 }}>Set up your clinic</h1>
          <p style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>You're the first admin — you can invite the rest of your staff after this.</p>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Clinic / practice name
          <input type="text" placeholder="e.g. Lakeside Family Medicine" value={orgName} onChange={e => setOrgName(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 14 }}>
          Your name
          <input type="text" placeholder="e.g. Kelly" value={adminName} onChange={e => setAdminName(e.target.value)} onKeyDown={e => e.key === "Enter" && submitOrg()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        <ErrBox err={err} />
        <button onClick={submitOrg} disabled={busy} style={{ width: "100%", marginTop: 16, padding: 13, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Setting up…" : "Create Organization"}</button>
        <div style={{ marginTop: 16, textAlign: "center" }}><a href="#" onClick={e => { e.preventDefault(); signOut(); }} style={{ fontSize: 12, color: "#9ca3af" }}>Sign out</a></div>
      </div>
    </div>
  );
}
