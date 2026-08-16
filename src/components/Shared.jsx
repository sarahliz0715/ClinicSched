import { useCallback, useState } from "react";
import { siteColor, labelS, inputS } from "../lib/ui";
import { buildGCalUrl, exportICS } from "../lib/calendar";

export function Toast({ msg, color = "#1e3a5f" }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", top: 70, right: 20, zIndex: 999, background: color, color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", maxWidth: 380 }}>
      {msg}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState("");
  const [color, setColor] = useState("#1e3a5f");
  const show = useCallback((m, c = "#1e3a5f") => { setMsg(m); setColor(c); setTimeout(() => setMsg(""), 4000); }, []);
  return [msg, color, show];
}

export function Spinner() {
  return <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading…</div>;
}

export function ErrBox({ err }) {
  if (!err) return null;
  return <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>⚠️ {err}</div>;
}

export function SiteBadge({ site }) {
  return <span style={{ background: siteColor(site), color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700, display: "inline-block" }}>{site?.name || "Unknown site"}</span>;
}

export function AddToCalBtn({ shift, userName, gcalConnected }) {
  const [done, setDone] = useState(false);
  function handle() {
    gcalConnected ? window.open(buildGCalUrl(shift, shift.site?.name || "Shift", userName), "_blank") : exportICS([shift], userName);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }
  return (
    <button onClick={handle} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #4285f4", background: done ? "#4285f4" : "#fff", color: done ? "#fff" : "#4285f4", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, transition: "all 0.2s", whiteSpace: "nowrap" }}>
      {done ? "✓ Added!" : <><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{ width: 14, height: 14 }} />{gcalConnected ? "Add to Google Cal" : "Download .ics"}</>}
    </button>
  );
}

export function GCalBanner({ gcalConnected, setGcalConnected }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, clr, show] = useToast();
  function connect() { setSyncing(true); setTimeout(() => { setSyncing(false); setGcalConnected(true); show("✅ Google Calendar connected!", "#059669"); }, 1500); }
  return (
    <>
      <Toast msg={msg} color={clr} />
      <div style={{ background: gcalConnected ? "#f0fdf4" : "#fffbeb", border: `1px solid ${gcalConnected ? "#86efac" : "#fcd34d"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{ width: 28, height: 28 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: gcalConnected ? "#166534" : "#92400e" }}>{gcalConnected ? "✓ Google Calendar Connected" : "Connect Your Google Calendar"}</div>
            <div style={{ fontSize: 12, color: gcalConnected ? "#166534" : "#92400e", opacity: 0.8 }}>{gcalConnected ? "Shifts sync automatically — use your personal Gmail." : "Use your personal Gmail — no work IT needed."}</div>
          </div>
        </div>
        {gcalConnected
          ? <button onClick={() => setGcalConnected(false)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #86efac", background: "#fff", color: "#166534", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Disconnect</button>
          : <button onClick={connect} disabled={syncing} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#4285f4", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: syncing ? 0.7 : 1 }}>{syncing ? "Connecting…" : "Connect Google Calendar"}</button>}
      </div>
    </>
  );
}

export function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid #d1d5db", overflow: "hidden", marginBottom: 20 }}>
      {["week", "month"].map(v => (
        <button key={v} onClick={() => setView(v)} style={{ padding: "7px 18px", border: "none", background: view === v ? "#1e3a5f" : "#fff", color: view === v ? "#fff" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: view === v ? 700 : 400, transition: "all 0.15s" }}>
          {v === "week" ? "📅 Week" : "🗓 Month"}
        </button>
      ))}
    </div>
  );
}

export function CalNav({ label, onPrev, onNext }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <button onClick={onPrev} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>‹ Prev</button>
      <span style={{ fontWeight: 600, fontSize: 15, color: "#1e3a5f" }}>{label}</span>
      <button onClick={onNext} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Next ›</button>
    </div>
  );
}

export function FormField({ label, children }) {
  return <label style={labelS}>{label}{children}</label>;
}

export const sharedInputStyle = inputS;
