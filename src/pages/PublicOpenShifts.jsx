import { useEffect, useState } from "react";
import { formatDateLong } from "../lib/dates";
import { labelS, inputS, siteColor } from "../lib/ui";
import { exportICS } from "../lib/calendar";
import { publicFetchOpenShifts, publicClaimShift } from "../lib/api";
import { Spinner } from "../components/Shared";

export default function PublicOpenShifts({ token }) {
  const [name, setName] = useState("");
  const [claimed, setClaimed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [orgName, setOrgName] = useState("");
  const [shifts, setShifts] = useState([]);
  const [claiming, setClaiming] = useState(null);

  useEffect(() => {
    let mounted = true;
    publicFetchOpenShifts(token)
      .then(body => { if (!mounted) return; setOrgName(body.organization_name); setShifts(body.shifts); setLoading(false); })
      .catch(e => { if (!mounted) return; setErr(e.message); setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  async function claim(shift) {
    if (!name.trim()) { alert("Enter your name first!"); return; }
    setClaiming(shift.id);
    try {
      await publicClaimShift({ token, shiftId: shift.id, claimerName: name.trim() });
      setClaimed(shift);
    } catch (e) {
      setErr(e.message);
    } finally {
      setClaiming(null);
    }
  }

  if (loading) return <div style={{ minHeight: "100vh", background: "#0f2442" }}><Spinner /></div>;

  if (err && !shifts.length && !claimed) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f2442 0%,#1e3a5f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
          <h2 style={{ color: "#1e3a5f" }}>Link not found</h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>{err}</p>
        </div>
      </div>
    );
  }

  if (claimed) return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 48, maxWidth: 460, textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#1e3a5f", margin: "0 0 10px" }}>Shift Claimed!</h2>
        <p style={{ color: "#6b7280", marginBottom: 24 }}><strong>{name}</strong>, you're confirmed for <strong>{claimed.site_name}</strong> on <strong>{formatDateLong(claimed.date)}</strong>, {claimed.start_time}–{claimed.end_time}.</p>
        <button onClick={() => exportICS([{ date: claimed.date, start_time: claimed.start_time, end_time: claimed.end_time, notes: claimed.notes }], name, () => claimed.site_name)} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#4285f4", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>⬇ Download to Calendar</button>
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 20 }}>The admin will be notified automatically.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f2442 0%,#1e3a5f 100%)", fontFamily: "'Segoe UI',sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🏥</div>
          <h1 style={{ color: "#fff", margin: 0, fontSize: 28, fontWeight: 800 }}>Open Shifts</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 8, fontSize: 15 }}>{orgName} · See an open shift you can cover? Enter your name and claim it.</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <label style={{ ...labelS, color: "#fff" }}>Your Name<input type="text" placeholder="e.g. Sarah" value={name} onChange={e => setName(e.target.value)} style={{ ...inputS, background: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: 15 }} /></label>
        </div>
        {shifts.length === 0 ? <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 48, textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 16 }}>🎉 No open shifts right now!</div>
          : shifts.map(s => (
            <div key={s.id} style={{ background: "#fff", borderRadius: 16, padding: 24, marginBottom: 16, borderLeft: `5px solid ${s.site_color || siteColor()}`, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ background: s.site_color || "#6b7280", color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{s.site_name}</span>
                    <span style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 17 }}>{formatDateLong(s.date)}</span>
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 4 }}>🕐 {s.start_time} – {s.end_time}</div>
                  {s.notes && <div style={{ color: "#9ca3af", fontSize: 13 }}>📋 {s.notes}</div>}
                </div>
                <button onClick={() => claim(s)} disabled={claiming === s.id} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", opacity: claiming === s.id ? 0.7 : 1 }}>{claiming === s.id ? "Claiming…" : "✋ I'll Take It"}</button>
              </div>
            </div>
          ))
        }
        {err && <div style={{ color: "#fca5a5", textAlign: "center", marginTop: 12, fontSize: 13 }}>{err}</div>}
        <div style={{ textAlign: "center", marginTop: 32, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Powered by ClinicSched · <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { window.location.hash = ""; }}>Staff login →</span></div>
      </div>
    </div>
  );
}
