import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { signOut } from "./lib/api";
import { fetchSites, fetchStaff, fetchShifts } from "./lib/api";
import { Spinner, ErrBox, GCalBanner } from "./components/Shared";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OnboardingGate from "./pages/OnboardingGate";
import PublicOpenShifts from "./pages/PublicOpenShifts";
import MySchedule from "./pages/MySchedule";
import OpenShifts from "./pages/OpenShifts";
import BySite from "./pages/BySite";
import ByLead from "./pages/ByLead";
import ExcelPanel from "./pages/ExcelPanel";
import AddShift from "./pages/AddShift";
import AdminPanel from "./pages/AdminPanel";
import SettingsPanel from "./pages/SettingsPanel";

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const h = () => setHash(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return hash;
}

function AuthenticatedApp({ profile, refreshProfile }) {
  const [tab, setTab] = useState(profile.role === "admin" ? "admin" : "my");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [sites, setSites] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [s, u, sh] = await Promise.all([fetchSites(), fetchStaff(), fetchShifts()]);
      setSites(s);
      setStaff(u);
      setShifts(sh);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const isAdmin = profile.role === "admin";
  const openCount = shifts.filter(s => s.status === "open" && s.date >= new Date().toISOString().split("T")[0]).length;
  const tabs = [
    { id: "my", label: "My Schedule", icon: "📅" },
    { id: "open", label: "Open Shifts", icon: "🟡", badge: openCount },
    { id: "site", label: "By Site", icon: "🏥" },
    { id: "lead", label: "By Lead", icon: "👥" },
    { id: "excel", label: "Import/Export", icon: "🟢" },
    ...(isAdmin ? [
      { id: "addshift", label: "Add Shift", icon: "➕" },
      { id: "admin", label: "Admin", icon: "⚙️" },
      { id: "settings", label: "Settings", icon: "🛠️" },
    ] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: "#1e3a5f", color: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🏥 {profile.organization?.name || "ClinicSched"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>{profile.name}{isAdmin && <span style={{ marginLeft: 8, background: "#f59e0b", borderRadius: 4, padding: "1px 7px", fontSize: 11, color: "#fff", fontWeight: 700 }}>Admin</span>}</span>
          <button onClick={() => signOut()} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
        </div>
      </div>
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 24px", gap: 4, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "14px 18px", border: "none", background: "none", position: "relative", borderBottom: `3px solid ${tab === t.id ? "#1e3a5f" : "transparent"}`, color: tab === t.id ? "#1e3a5f" : "#6b7280", fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", transition: "all 0.15s" }}>
            {t.icon} {t.label}
            {t.badge > 0 && <span style={{ position: "absolute", top: 8, right: 4, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{t.badge}</span>}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        <ErrBox err={err} />
        <GCalBanner gcalConnected={gcalConnected} setGcalConnected={setGcalConnected} />
        {loading ? <Spinner /> : (
          <>
            {tab === "my" && <MySchedule profile={profile} gcalConnected={gcalConnected} shifts={shifts} />}
            {tab === "open" && <OpenShifts profile={profile} isAdmin={isAdmin} gcalConnected={gcalConnected} shifts={shifts} sites={sites} org={profile.organization} onRefresh={loadAll} />}
            {tab === "site" && <BySite shifts={shifts} sites={sites} staff={staff} />}
            {tab === "lead" && <ByLead shifts={shifts} staff={staff} />}
            {tab === "excel" && <ExcelPanel shifts={shifts} sites={sites} staff={staff} onRefresh={loadAll} />}
            {tab === "addshift" && isAdmin && <AddShift shifts={shifts} sites={sites} staff={staff} onRefresh={loadAll} />}
            {tab === "admin" && isAdmin && <AdminPanel shifts={shifts} sites={sites} staff={staff} onRefresh={loadAll} />}
            {tab === "settings" && isAdmin && <SettingsPanel org={profile.organization} sites={sites} staff={staff} profile={profile} onRefresh={loadAll} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const hash = useHash();
  const { loading, session, profile, profileError, refreshProfile } = useAuth();
  const inviteToken = hash.startsWith("#invite/") ? hash.slice("#invite/".length) : null;
  // A brand-new invitee needs Create Account, not Sign In — default there
  // when arriving via an invite link. Still just a toggle either way: see
  // Login.jsx/Signup.jsx for the "already have an account?" path back.
  const [authView, setAuthView] = useState(() => (inviteToken ? "signup" : "login"));

  if (hash.startsWith("#open/")) {
    return <PublicOpenShifts token={hash.slice("#open/".length)} />;
  }

  if (loading) return <Spinner />;

  if (!session) {
    const banner = inviteToken ? "You've been invited to join a clinic on ClinicSched." : null;
    return authView === "signup"
      ? <Signup onGoLogin={() => setAuthView("login")} banner={banner} isInvite={!!inviteToken} inviteToken={inviteToken} />
      : <Login onGoSignup={() => setAuthView("signup")} banner={banner} isInvite={!!inviteToken} />;
  }

  if (profileError) return <div style={{ padding: 40 }}><ErrBox err={profileError} /></div>;

  if (!profile) {
    return <OnboardingGate inviteToken={inviteToken} onDone={refreshProfile} />;
  }

  return <AuthenticatedApp profile={profile} refreshProfile={refreshProfile} />;
}
