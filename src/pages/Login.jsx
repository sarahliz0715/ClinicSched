import { useState } from "react";
import { signIn } from "../lib/api";

export default function Login({ onGoSignup, banner, isInvite }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    setErr("");
    setBusy(true);
    try {
      await signIn({ email, password: pass });
      // onAuthStateChange in useAuth picks this up and re-renders the app.
    } catch (e) {
      setErr(e.message || "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f2442 0%,#1e3a5f 50%,#0f2442 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia',serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
          <h1 style={{ margin: 0, fontSize: 26, color: "#1e3a5f", fontWeight: 800 }}>ClinicSched</h1>
          <p style={{ color: "#6b7280", margin: "6px 0 0", fontSize: 14 }}>Your schedule, anywhere.</p>
        </div>

        {/* Both paths visible at once — not just a small link — so this
            works whether the person already has an account or not. */}
        <div style={{ display: "flex", borderRadius: 10, border: "1px solid #d1d5db", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ flex: 1, textAlign: "center", padding: "9px 0", background: "#1e3a5f", color: "#fff", fontWeight: 700, fontSize: 13 }}>Sign In</div>
          <button onClick={onGoSignup} style={{ flex: 1, textAlign: "center", padding: "9px 0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, border: "none", borderLeft: "1px solid #d1d5db", cursor: "pointer" }}>
            {isInvite ? "Create Account" : "New Clinic"}
          </button>
        </div>

        {banner && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#1e40af" }}>{banner}</div>}
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Email
          <input type="email" placeholder="you@clinic.org" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 14 }}>
          Password
          <input type="password" placeholder="••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, marginTop: 2 }} />
        </label>
        {err && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>{err}</div>}
        <button onClick={handle} disabled={busy} style={{ width: "100%", marginTop: 20, padding: 13, background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "Signing in…" : "Sign In"}</button>
        {isInvite && (
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#6b7280" }}>
            Don't have an account yet? <a href="#signup" onClick={e => { e.preventDefault(); onGoSignup(); }} style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }}>Create one →</a>
          </div>
        )}
      </div>
    </div>
  );
}
