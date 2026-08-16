import { useState } from "react";
import { signUp } from "../lib/api";

export default function Signup({ onGoLogin, banner }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handle() {
    setErr("");
    if (pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const { session } = await signUp({ email, password: pass });
      if (!session) {
        // Supabase project has "Confirm email" enabled — no session until
        // they click the link. useAuth() will pick things up once they're
        // actually signed in.
        setCheckEmail(true);
      }
      // If a session came back immediately, useAuth's onAuthStateChange
      // fires and App.jsx moves on to the "set up your clinic" step.
    } catch (e) {
      setErr(e.message || "Couldn't create your account.");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f2442 0%,#1e3a5f 50%,#0f2442 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia',serif" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📬</div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e3a5f", fontWeight: 800 }}>Check your email</h1>
          <p style={{ color: "#6b7280", marginTop: 10, fontSize: 14 }}>We sent a confirmation link to <strong>{email}</strong>. Click it, then come back here and sign in — we'll walk you through setting up your clinic.</p>
          <a href="#login" onClick={e => { e.preventDefault(); onGoLogin(); }} style={{ color: "#2563eb", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f2442 0%,#1e3a5f 50%,#0f2442 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia',serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#1e3a5f", fontWeight: 800 }}>Create your account</h1>
          <p style={{ color: "#6b7280", margin: "6px 0 0", fontSize: 14 }}>Set up ClinicSched for your clinic or practice.</p>
        </div>
        {banner && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#1e40af" }}>{banner}</div>}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Email
          <input type="email" placeholder="you@clinic.org" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 14 }}>
          Password
          <input type="password" placeholder="At least 6 characters" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        {err && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button onClick={handle} disabled={busy} style={{ width: "100%", marginTop: 20, padding: 13, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Creating…" : "Continue"}</button>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#6b7280" }}>
          Already have an account? <a href="#login" onClick={e => { e.preventDefault(); onGoLogin(); }} style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }}>Sign in →</a>
        </div>
      </div>
    </div>
  );
}
