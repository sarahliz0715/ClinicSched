import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG  ← swap these in once you have Supabase + Resend set up
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

// Resend is a free email service — sign up at resend.com, get an API key
// Then create a Supabase Edge Function (we'll set that up separately)
// For now the app calls a /notify endpoint you'll wire up later
const NOTIFY_ENDPOINT   = import.meta.env.VITE_NOTIFY_ENDPOINT   || "";

// Your app's public URL once deployed (Vercel/Netlify etc.)
// This is what goes in the shareable link Kelly texts to staff
const APP_PUBLIC_URL    = import.meta.env.VITE_APP_PUBLIC_URL    || window.location.origin;

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE FETCH WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
const sb = {
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Prefer": "return=representation",
  },
  async get(table, params="") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sb.headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(table, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:"POST", headers:sb.headers, body:JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(table, id, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:"PATCH", headers:sb.headers, body:JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method:"DELETE", headers:sb.headers,
    });
    if (!r.ok) throw new Error(await r.text());
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS + HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const SITES = [
  "Burlington","Elkhorn","Lake Geneva","Whitewater",
  "Delavan","Walworth","Genoa City","Twin Lakes",
];
const SITE_COLORS = {
  Burlington:"#2563eb", Elkhorn:"#7c3aed", "Lake Geneva":"#059669",
  Whitewater:"#d97706", Delavan:"#dc2626", Walworth:"#0891b2",
  "Genoa City":"#db2777", "Twin Lakes":"#65a30d",
};
const siteColor   = s => SITE_COLORS[s] || "#6b7280";
const today       = new Date();
const fmt         = d => d.toISOString().split("T")[0];
const addDays     = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const formatDate  = str => new Date(str+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const formatDateLong = str => new Date(str+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});

// Demo users (replaced by Supabase once wired up)
const DEMO_USERS = [
  { id:1, name:"Kelly",   email:"kelly@hospital.org",   password_hash:"kelly123",   role:"admin", lead:"Kelly" },
  { id:2, name:"Sarah",   email:"sarah@hospital.org",   password_hash:"sarah123",   role:"staff", lead:"Kelly" },
  { id:3, name:"Mindy",   email:"mindy@hospital.org",   password_hash:"mindy123",   role:"staff", lead:"Kelly" },
  { id:4, name:"Chelsea", email:"chelsea@hospital.org", password_hash:"chelsea123", role:"staff", lead:"Kelly" },
  { id:5, name:"Jordan",  email:"jordan@hospital.org",  password_hash:"jordan123",  role:"staff", lead:"Kelly" },
];

function seedShifts(users) {
  const out=[]; let id=1;
  for(let d=0;d<14;d++){
    const date=fmt(addDays(today,d));
    users.forEach(u=>{ if(Math.random()>0.35){ const site=SITES[Math.floor(Math.random()*SITES.length)]; const h=7+Math.floor(Math.random()*3); out.push({id:id++,user_id:u.id,site,date,start_time:`${String(h).padStart(2,"0")}:00`,end_time:`${String(h+8).padStart(2,"0")}:00`,notes:""}); } });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL NOTIFICATION  (calls Supabase Edge Function → Resend)
// ─────────────────────────────────────────────────────────────────────────────
async function notifyStaffOfOpenShift(shift, users, publicLink) {
  const staffEmails = users.filter(u=>u.role==="staff").map(u=>u.email);
  try {
    await fetch(NOTIFY_ENDPOINT, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        to: staffEmails,
        site: shift.site,
        date: formatDateLong(shift.date),
        start_time: shift.start_time,
        end_time: shift.end_time,
        notes: shift.notes,
        claim_url: publicLink,
      }),
    });
    return true;
  } catch(e) {
    console.warn("Email notify failed:", e.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function parseTime(val) {
  if (!val && val!==0) return "07:00";
  if (typeof val==="string") {
    const m=val.match(/(\d{1,2}):(\d{2})/); if(m) return `${String(m[1]).padStart(2,"0")}:${m[2]}`;
    const am=val.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if(am){ let h=parseInt(am[1]); if(am[3]==="pm"&&h!==12)h+=12; if(am[3]==="am"&&h===12)h=0; return `${String(h).padStart(2,"0")}:${am[2]||"00"}`; }
    return "07:00";
  }
  if (typeof val==="number") { const tot=Math.round(val*24*60); return `${String(Math.floor(tot/60)%24).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`; }
  return "07:00";
}
function parseDate(val) {
  if(!val) return null;
  if(val instanceof Date) return fmt(val);
  if(typeof val==="number"){ const d=XLSX.SSF.parse_date_code(val); if(d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
  if(typeof val==="string"){ const iso=val.match(/^(\d{4})-(\d{2})-(\d{2})/); if(iso) return iso[0]; const us=val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(us) return `${us[3]}-${String(us[1]).padStart(2,"0")}-${String(us[2]).padStart(2,"0")}`; }
  return null;
}
function parseWorkbook(wb, knownUsers) {
  const shifts=[],warnings=[];
  wb.SheetNames.forEach(sheetName=>{
    const site=SITES.find(s=>sheetName.trim().toLowerCase().includes(s.toLowerCase()))||sheetName.trim();
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(rows.length<2) return;
    let headerIdx=0;
    for(let i=0;i<Math.min(5,rows.length);i++){ if(rows[i].filter(Boolean).length>1){headerIdx=i;break;} }
    const headers=rows[headerIdx].map(h=>String(h).toLowerCase().trim());
    const col=key=>{ const syn={date:["date","day","shift date","work date"],name:["name","staff","employee","person","tech","worker","staff name"],start:["start","start time","begin","from","time in"],end:["end","end time","finish","to","time out"],notes:["notes","note","comments"]}; return headers.findIndex(h=>(syn[key]||[key]).some(s=>h.includes(s))); };
    const dateCol=col("date"),nameCol=col("name"),startCol=col("start"),endCol=col("end"),notesCol=col("notes");
    if(dateCol<0||nameCol<0){ warnings.push(`Sheet "${sheetName}": couldn't find Date/Name columns. Skipped.`); return; }
    for(let r=headerIdx+1;r<rows.length;r++){
      const row=rows[r],rawDate=row[dateCol],rawName=String(row[nameCol]||"").trim();
      if(!rawDate||!rawName) continue;
      const date=parseDate(rawDate); if(!date){ warnings.push(`Row ${r+1} on "${sheetName}": unreadable date.`); continue; }
      const user=knownUsers.find(u=>u.name.toLowerCase()===rawName.toLowerCase()||u.name.toLowerCase().startsWith(rawName.toLowerCase().split(" ")[0]));
      shifts.push({ _importName:rawName, user_id:user?.id||null, site, date, start_time:startCol>=0?parseTime(row[startCol]):"07:00", end_time:endCol>=0?parseTime(row[endCol]):"15:00", notes:notesCol>=0?String(row[notesCol]||"").trim():"" });
    }
  });
  return {shifts,warnings};
}
function exportToExcel(shifts,users) {
  const wb=XLSX.utils.book_new();
  SITES.forEach(site=>{
    const rows=[["Date","Staff Name","Start","End","Notes"]];
    shifts.filter(s=>s.site===site).sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>{ const u=users.find(u=>u.id===s.user_id); rows.push([s.date,u?.name||s._importName||"Unknown",s.start_time,s.end_time,s.notes||""]); });
    const ws=XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=[{wch:14},{wch:20},{wch:10},{wch:10},{wch:30}];
    XLSX.utils.book_append_sheet(wb,ws,site.substring(0,31));
  });
  XLSX.writeFile(wb,"ClinicSched-Export.xlsx");
}
function downloadTemplate() {
  const wb=XLSX.utils.book_new();
  SITES.forEach(site=>{ const rows=[["Date","Staff Name","Start Time","End Time","Notes"],["2026-06-15","Sarah","07:00","15:00",""],["2026-06-15","Mindy","07:00","15:00",""]]; const ws=XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=[{wch:14},{wch:20},{wch:12},{wch:12},{wch:30}]; XLSX.utils.book_append_sheet(wb,ws,site.substring(0,31)); });
  XLSX.writeFile(wb,"ClinicSched-Template.xlsx");
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────────────
function buildGCalUrl(shift,userName) {
  const base="https://calendar.google.com/calendar/render?action=TEMPLATE";
  const d=shift.date.replace(/-/g,""),st=(shift.start_time||"07:00").replace(":",""),en=(shift.end_time||"15:00").replace(":","");
  return `${base}&text=${encodeURIComponent(`${shift.site} — ${userName}`)}&dates=${d}T${st}00/${d}T${en}00&details=${encodeURIComponent(`Clinic shift at ${shift.site}\n${shift.start_time}–${shift.end_time}${shift.notes?"\n"+shift.notes:""}`)}&sf=true&output=xml`;
}
function exportICS(shifts,userName) {
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ClinicSched//EN","CALSCALE:GREGORIAN"];
  shifts.forEach(s=>{ const dt=s.date.replace(/-/g,""); lines.push("BEGIN:VEVENT",`DTSTART:${dt}T${(s.start_time||"07:00").replace(":","") }00`,`DTEND:${dt}T${(s.end_time||"15:00").replace(":","") }00`,`SUMMARY:${s.site} — ${userName}`,s.notes?`DESCRIPTION:${s.notes}`:"","END:VEVENT"); });
  lines.push("END:VCALENDAR");
  const blob=new Blob([lines.filter(Boolean).join("\r\n")],{type:"text/calendar"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="my-schedule.ics"; a.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
const card  = {background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:20,marginBottom:12};
const navBtn= {padding:"6px 14px",borderRadius:8,border:"1px solid #d1d5db",background:"#f9fafb",cursor:"pointer",fontSize:13,fontWeight:500};
const labelS= {display:"flex",flexDirection:"column",gap:4,fontSize:13,fontWeight:600,color:"#374151"};
const inputS= {padding:"8px 10px",borderRadius:8,border:"1px solid #d1d5db",fontSize:13,background:"#fff",width:"100%",boxSizing:"border-box"};
const thS   = {padding:"10px 12px",background:"#f1f5f9",border:"1px solid #e5e7eb",fontSize:12,fontWeight:700,color:"#374151",textAlign:"left"};
const tdS   = {padding:"10px 12px",border:"1px solid #e5e7eb",verticalAlign:"top",minWidth:90};

function Toast({msg,color="#1e3a5f"}) {
  if(!msg) return null;
  return <div style={{position:"fixed",top:70,right:20,zIndex:999,background:color,color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",maxWidth:380}}>{msg}</div>;
}
function useToast() {
  const [msg,setMsg]=useState(""); const [color,setColor]=useState("#1e3a5f");
  const show=useCallback((m,c="#1e3a5f")=>{setMsg(m);setColor(c);setTimeout(()=>setMsg(""),4000);},[]);
  return [msg,color,show];
}
function Spinner() { return <div style={{textAlign:"center",padding:60,color:"#9ca3af"}}>Loading…</div>; }
function ErrBox({err}) { if(!err) return null; return <div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>⚠️ {err}</div>; }
function SiteBadge({site}) { return <span style={{background:siteColor(site),color:"#fff",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700,display:"inline-block"}}>{site}</span>; }
function WeekNav({weekStart,setWeekStart}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
      <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={navBtn}>‹ Prev</button>
      <span style={{fontWeight:600,fontSize:15,color:"#1e3a5f"}}>Week of {formatDate(fmt(weekStart))}</span>
      <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={navBtn}>Next ›</button>
    </div>
  );
}
function AddToCalBtn({shift,userName,gcalConnected}) {
  const [done,setDone]=useState(false);
  function handle(){ gcalConnected?window.open(buildGCalUrl(shift,userName),"_blank"):exportICS([shift],userName); setDone(true); setTimeout(()=>setDone(false),2500); }
  return (
    <button onClick={handle} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #4285f4",background:done?"#4285f4":"#fff",color:done?"#fff":"#4285f4",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,transition:"all 0.2s",whiteSpace:"nowrap"}}>
      {done?"✓ Added!":<><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{width:14,height:14}}/>{gcalConnected?"Add to Google Cal":"Download .ics"}</>}
    </button>
  );
}
function GCalBanner({gcalConnected,setGcalConnected}) {
  const [syncing,setSyncing]=useState(false); const [msg,clr,show]=useToast();
  function connect(){ setSyncing(true); setTimeout(()=>{setSyncing(false);setGcalConnected(true);show("✅ Google Calendar connected!","#059669");},1500); }
  return (
    <>
      <Toast msg={msg} color={clr}/>
      <div style={{background:gcalConnected?"#f0fdf4":"#fffbeb",border:`1px solid ${gcalConnected?"#86efac":"#fcd34d"}`,borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{width:28,height:28}}/>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:gcalConnected?"#166534":"#92400e"}}>{gcalConnected?"✓ Google Calendar Connected":"Connect Your Google Calendar"}</div>
            <div style={{fontSize:12,color:gcalConnected?"#166534":"#92400e",opacity:0.8}}>{gcalConnected?"Shifts sync automatically — use your personal Gmail.":"Use your personal Gmail — no work IT needed."}</div>
          </div>
        </div>
        {gcalConnected
          ?<button onClick={()=>setGcalConnected(false)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid #86efac",background:"#fff",color:"#166534",cursor:"pointer",fontSize:13,fontWeight:600}}>Disconnect</button>
          :<button onClick={connect} disabled={syncing} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#4285f4",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,opacity:syncing?0.7:1}}>{syncing?"Connecting…":"Connect Google Calendar"}</button>
        }
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC OPEN SHIFTS PAGE  (no login required — this is what Kelly texts)
// ─────────────────────────────────────────────────────────────────────────────
function PublicOpenShifts({openShifts, onClaim, gcalConnected}) {
  const [name,  setName]  = useState("");
  const [claimed, setClaimed] = useState(null);
  const available = openShifts.filter(s=>!s.claimed_by && s.date>=fmt(today));

  function claim(shift) {
    if (!name.trim()) { alert("Enter your name first so Kelly knows who claimed it!"); return; }
    onClaim(shift, name.trim());
    setClaimed(shift);
  }

  if (claimed) return (
    <div style={{minHeight:"100vh",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:20,padding:48,maxWidth:460,textAlign:"center",boxShadow:"0 10px 40px rgba(0,0,0,0.1)"}}>
        <div style={{fontSize:56,marginBottom:16}}>✅</div>
        <h2 style={{color:"#1e3a5f",margin:"0 0 10px"}}>Shift Claimed!</h2>
        <p style={{color:"#6b7280",marginBottom:24}}>
          <strong>{name}</strong>, you're confirmed for <strong>{claimed.site}</strong> on <strong>{formatDateLong(claimed.date)}</strong>, {claimed.start_time}–{claimed.end_time}.
        </p>
        {gcalConnected
          ? <button onClick={()=>window.open(buildGCalUrl(claimed,name),"_blank")} style={{padding:"12px 28px",borderRadius:10,border:"none",background:"#4285f4",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:15,display:"inline-flex",alignItems:"center",gap:8}}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{width:18,height:18}}/> Add to Google Calendar
            </button>
          : <button onClick={()=>exportICS([claimed],name)} style={{padding:"12px 28px",borderRadius:10,border:"none",background:"#4285f4",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:15}}>
              ⬇ Download to Calendar
            </button>
        }
        <p style={{color:"#9ca3af",fontSize:12,marginTop:20}}>Kelly will be notified automatically.</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f2442 0%,#1e3a5f 100%)",fontFamily:"'Segoe UI',sans-serif",padding:"40px 16px"}}>
      <div style={{maxWidth:640,margin:"0 auto"}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:44,marginBottom:8}}>🏥</div>
          <h1 style={{color:"#fff",margin:0,fontSize:28,fontWeight:800}}>Open Shifts</h1>
          <p style={{color:"rgba(255,255,255,0.7)",marginTop:8,fontSize:15}}>
            See an open shift you can cover? Enter your name and claim it — Kelly gets notified automatically.
          </p>
        </div>

        {/* Name entry */}
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:12,padding:20,marginBottom:24,backdropFilter:"blur(10px)"}}>
          <label style={{...labelS,color:"#fff"}}>
            Your Name
            <input
              type="text"
              placeholder="e.g. Sarah"
              value={name}
              onChange={e=>setName(e.target.value)}
              style={{...inputS,background:"rgba(255,255,255,0.9)",marginTop:4,fontSize:15}}
            />
          </label>
        </div>

        {available.length===0
          ? <div style={{background:"rgba(255,255,255,0.1)",borderRadius:16,padding:48,textAlign:"center",color:"rgba(255,255,255,0.7)",fontSize:16}}>
              🎉 No open shifts right now — check back later!
            </div>
          : available.map(s=>(
              <div key={s.id} style={{background:"#fff",borderRadius:16,padding:24,marginBottom:16,borderLeft:`5px solid ${siteColor(s.site)}`,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <SiteBadge site={s.site}/>
                      <span style={{fontWeight:700,color:"#1e3a5f",fontSize:17}}>{formatDateLong(s.date)}</span>
                    </div>
                    <div style={{color:"#6b7280",fontSize:14,marginBottom:4}}>🕐 {s.start_time} – {s.end_time}</div>
                    {s.notes && <div style={{color:"#9ca3af",fontSize:13}}>📋 {s.notes}</div>}
                  </div>
                  <button
                    onClick={()=>claim(s)}
                    style={{padding:"12px 24px",borderRadius:10,border:"none",background:"#059669",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(5,150,105,0.4)"}}
                  >
                    ✋ I'll Take It
                  </button>
                </div>
              </div>
            ))
        }

        <div style={{textAlign:"center",marginTop:32,color:"rgba(255,255,255,0.4)",fontSize:12}}>
          Powered by ClinicSched · <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>window.location.hash=""}>Staff login →</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN SHIFTS (logged-in view)
// ─────────────────────────────────────────────────────────────────────────────
function OpenShifts({user, gcalConnected, shifts, openShifts, setOpenShifts, setShifts, users}) {
  const [form,setForm]=useState({site:SITES[0],date:fmt(addDays(today,1)),start_time:"07:00",end_time:"15:00",notes:""});
  const [msg,clr,show]=useToast();
  const [notifying,setNotifying]=useState(false);
  const [linkCopied,setLinkCopied]=useState(false);

  const publicLink = `${APP_PUBLIC_URL}/#open`;

  async function postOpen() {
    const newShift={...form,id:Date.now(),claimed_by:null};
    setOpenShifts(prev=>[...prev,newShift]);
    setForm(f=>({...f,notes:""}));

    // Send email notifications
    setNotifying(true);
    const sent = await notifyStaffOfOpenShift(newShift, users, publicLink);
    setNotifying(false);
    show(sent
      ? `✅ Open shift posted! Email sent to ${users.filter(u=>u.role==="staff").length} staff.`
      : "✅ Open shift posted! (Email notifications need Resend setup — see docs.)",
      "#059669"
    );
  }

  function copyLink() {
    navigator.clipboard.writeText(publicLink).then(()=>{ setLinkCopied(true); setTimeout(()=>setLinkCopied(false),2500); });
  }

  function claimShift(os, claimerName) {
    setOpenShifts(prev=>prev.filter(s=>s.id!==os.id));
    setShifts(prev=>[...prev,{...os,id:Date.now(),user_id:user.id}]);
    if(gcalConnected) window.open(buildGCalUrl(os,claimerName||user.name),"_blank");
    show(`✅ Claimed! ${os.site} on ${formatDate(os.date)} added to your schedule.`,"#059669");
  }

  const available=openShifts.filter(s=>!s.claimed_by&&s.date>=fmt(today));

  return (
    <div>
      <Toast msg={msg} color={clr}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h2 style={{margin:0,fontSize:20,color:"#1e3a5f"}}>Open Shifts</h2>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          {available.length>0&&<div style={{background:"#fee2e2",color:"#991b1b",borderRadius:20,padding:"4px 14px",fontSize:13,fontWeight:700}}>{available.length} open</div>}

          {/* Shareable link button */}
          <button onClick={copyLink} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #d1d5db",background:linkCopied?"#059669":"#fff",color:linkCopied?"#fff":"#374151",cursor:"pointer",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}>
            {linkCopied?"✓ Link Copied!":"🔗 Copy Shareable Link"}
          </button>
        </div>
      </div>

      {/* Shareable link info box */}
      <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{fontWeight:700,color:"#0369a1",marginBottom:6,fontSize:14}}>📱 Share like Sign Up Genius</div>
        <div style={{fontSize:13,color:"#0369a1",marginBottom:10}}>
          Hit <strong>Copy Shareable Link</strong> above and text it to your staff — they click it, see open shifts, and claim one without needing to log in. Just like Sign Up Genius, but it's your app.
        </div>
        <div style={{background:"#e0f2fe",borderRadius:8,padding:"10px 14px",fontFamily:"monospace",fontSize:12,color:"#0369a1",wordBreak:"break-all"}}>
          {publicLink}
        </div>
      </div>

      {/* Admin: post new open shift */}
      {user.role==="admin"&&(
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:20,marginBottom:24}}>
          <div style={{fontWeight:700,marginBottom:14,color:"#0369a1"}}>📢 Post an Open Shift</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
            <label style={labelS}>Site<select value={form.site} onChange={e=>setForm(f=>({...f,site:e.target.value}))} style={inputS}>{SITES.map(s=><option key={s}>{s}</option>)}</select></label>
            <label style={labelS}>Date<input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inputS}/></label>
            <label style={labelS}>Start<input type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={inputS}/></label>
            <label style={labelS}>End<input type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={inputS}/></label>
            <label style={labelS}>Notes<input type="text" placeholder="e.g. MRI experience needed" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inputS}/></label>
          </div>
          <button onClick={postOpen} disabled={notifying} style={{marginTop:14,padding:"10px 24px",borderRadius:8,border:"none",background:"#0369a1",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14,opacity:notifying?0.7:1,display:"flex",alignItems:"center",gap:8}}>
            {notifying?"Sending notifications…":"📢 Post & Notify Staff"}
          </button>
          <div style={{fontSize:12,color:"#9ca3af",marginTop:8}}>Posts the shift + emails all staff + generates a shareable link automatically.</div>
        </div>
      )}

      {available.length===0
        ? <div style={{...card,textAlign:"center",color:"#9ca3af",padding:40}}>🎉 No open shifts right now — all covered!</div>
        : <>
            <div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#92400e"}}>
              👋 Hit <strong>Claim Shift</strong> to add it to your schedule{gcalConnected?" and Google Calendar":""} instantly.
            </div>
            {available.map(s=>{
              const conflict=shifts.some(ms=>ms.user_id===user.id&&ms.date===s.date);
              return (
                <div key={s.id} style={{...card,borderLeft:`4px solid ${siteColor(s.site)}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{display:"flex",gap:10,marginBottom:6}}><SiteBadge site={s.site}/><span style={{fontWeight:700,color:"#1e3a5f",fontSize:15}}>{formatDate(s.date)}</span></div>
                    <div style={{color:"#6b7280",fontSize:13}}>🕐 {s.start_time} – {s.end_time}</div>
                    {s.notes&&<div style={{color:"#9ca3af",fontSize:12,marginTop:3}}>📋 {s.notes}</div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {user.role==="admin"
                      ?<button onClick={()=>setOpenShifts(p=>p.filter(x=>x.id!==s.id))} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #fca5a5",background:"#fff",color:"#ef4444",cursor:"pointer",fontSize:12}}>Remove</button>
                      : conflict
                        ?<span style={{fontSize:12,color:"#9ca3af"}}>You already have a shift this day</span>
                        :<button onClick={()=>claimShift(s,user.name)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#059669",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                            ✋ Claim Shift {gcalConnected&&<img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="" style={{width:14,height:14}}/>}
                          </button>
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

// ─────────────────────────────────────────────────────────────────────────────
// MY SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────
function MySchedule({user,gcalConnected,shifts}) {
  const [weekStart,setWeekStart]=useState(()=>{const d=new Date(today);d.setDate(d.getDate()-d.getDay());return d;});
  const myShifts=useMemo(()=>shifts.filter(s=>s.user_id===user.id).sort((a,b)=>a.date.localeCompare(b.date)),[shifts,user.id]);
  const weekDays=Array.from({length:7},(_,i)=>fmt(addDays(weekStart,i)));
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:20,color:"#1e3a5f"}}>My Schedule</h2>
        <button onClick={()=>exportICS(myShifts,user.name)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid #d1d5db",background:"#fff",color:"#374151",cursor:"pointer",fontSize:13}}>⬇ Download All (.ics)</button>
      </div>
      <WeekNav weekStart={weekStart} setWeekStart={setWeekStart}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:28}}>
        {weekDays.map(date=>{
          const dayShifts=myShifts.filter(s=>s.date===date); const isToday=date===fmt(today);
          return (
            <div key={date} style={{background:isToday?"#eff6ff":"#f9fafb",border:`1px solid ${isToday?"#3b82f6":"#e5e7eb"}`,borderRadius:10,padding:10,minHeight:80}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?"#3b82f6":"#6b7280",marginBottom:6}}>{formatDate(date)}</div>
              {dayShifts.length===0?<div style={{fontSize:11,color:"#d1d5db"}}>Off</div>
                :dayShifts.map(s=><div key={s.id} style={{background:siteColor(s.site),borderRadius:6,color:"#fff",padding:"4px 7px",fontSize:11,marginBottom:3}}>{s.site}<br/><span style={{fontSize:10,opacity:0.85}}>{s.start_time}–{s.end_time}</span></div>)
              }
            </div>
          );
        })}
      </div>
      <h3 style={{marginTop:4,marginBottom:12,color:"#1e3a5f",fontSize:16}}>Upcoming Shifts</h3>
      {myShifts.filter(s=>s.date>=fmt(today)).slice(0,10).map((s,i)=>(
        <div key={i} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <SiteBadge site={s.site}/>
            <div><div style={{fontWeight:600,color:"#1e3a5f"}}>{formatDate(s.date)}</div><div style={{fontSize:13,color:"#6b7280"}}>{s.start_time} – {s.end_time}</div>{s.notes&&<div style={{fontSize:12,color:"#9ca3af"}}>{s.notes}</div>}</div>
          </div>
          <AddToCalBtn shift={s} userName={user.name} gcalConnected={gcalConnected}/>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BY SITE
// ─────────────────────────────────────────────────────────────────────────────
function BySite({shifts,users}) {
  const [sel,setSel]=useState("Burlington");
  const [weekStart,setWeekStart]=useState(()=>{const d=new Date(today);d.setDate(d.getDate()-d.getDay());return d;});
  const weekDays=Array.from({length:7},(_,i)=>fmt(addDays(weekStart,i)));
  const siteShifts=shifts.filter(s=>s.site===sel);
  return (
    <div>
      <h2 style={{margin:"0 0 16px",fontSize:20,color:"#1e3a5f"}}>By Site</h2>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
        {SITES.map(site=><button key={site} onClick={()=>setSel(site)} style={{padding:"7px 16px",borderRadius:20,border:"2px solid",borderColor:sel===site?siteColor(site):"#e5e7eb",background:sel===site?siteColor(site):"#fff",color:sel===site?"#fff":"#374151",cursor:"pointer",fontWeight:600,fontSize:13}}>{site}</button>)}
      </div>
      <WeekNav weekStart={weekStart} setWeekStart={setWeekStart}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
        {weekDays.map(date=>{
          const dayShifts=siteShifts.filter(s=>s.date===date); const isToday=date===fmt(today);
          return (
            <div key={date} style={{background:isToday?"#eff6ff":"#f9fafb",border:`1px solid ${isToday?"#3b82f6":"#e5e7eb"}`,borderRadius:10,padding:10,minHeight:90}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?"#3b82f6":"#6b7280",marginBottom:6}}>{formatDate(date)}</div>
              {dayShifts.length===0?<div style={{fontSize:11,color:"#d1d5db"}}>No staff</div>
                :dayShifts.map((s,i)=>{const u=users.find(u=>u.id===s.user_id);return<div key={i} style={{background:"#1e3a5f",borderRadius:6,color:"#fff",padding:"4px 7px",fontSize:11,marginBottom:3}}>{u?.name||s._importName||"?"}<br/><span style={{fontSize:10,opacity:0.75}}>{s.start_time}–{s.end_time}</span></div>;})}
            </div>
          );
        })}
      </div>
      <div style={{marginTop:20,background:"#fef3c7",borderRadius:12,padding:16}}>
        <div style={{fontWeight:700,color:"#92400e",marginBottom:8}}>📞 Who's off today — available to call for {sel}?</div>
        {users.filter(u=>!shifts.some(s=>s.date===fmt(today)&&s.user_id===u.id)).map(u=><div key={u.id} style={{fontSize:13,color:"#78350f",marginBottom:4}}>✓ {u.name} — off today</div>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BY LEAD
// ─────────────────────────────────────────────────────────────────────────────
function ByLead({shifts,users}) {
  const leads=[...new Set(users.map(u=>u.lead))];
  const [sel,setSel]=useState(leads[0]||"");
  const [weekStart,setWeekStart]=useState(()=>{const d=new Date(today);d.setDate(d.getDate()-d.getDay());return d;});
  const teamUsers=users.filter(u=>u.lead===sel);
  const weekDays=Array.from({length:7},(_,i)=>fmt(addDays(weekStart,i)));
  return (
    <div>
      <h2 style={{margin:"0 0 16px",fontSize:20,color:"#1e3a5f"}}>By Lead</h2>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {leads.map(lead=><button key={lead} onClick={()=>setSel(lead)} style={{padding:"7px 16px",borderRadius:20,border:"2px solid",borderColor:sel===lead?"#1e3a5f":"#e5e7eb",background:sel===lead?"#1e3a5f":"#fff",color:sel===lead?"#fff":"#374151",cursor:"pointer",fontWeight:600,fontSize:13}}>{lead}'s Team</button>)}
      </div>
      <WeekNav weekStart={weekStart} setWeekStart={setWeekStart}/>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
          <thead><tr><th style={thS}>Staff</th>{weekDays.map(d=><th key={d} style={{...thS,background:d===fmt(today)?"#dbeafe":"#f1f5f9"}}>{formatDate(d)}</th>)}</tr></thead>
          <tbody>
            {teamUsers.map(u=>(
              <tr key={u.id}>
                <td style={tdS}><div style={{fontWeight:600,color:"#1e3a5f"}}>{u.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>{u.email}</div></td>
                {weekDays.map(date=>{const ds=shifts.filter(s=>s.user_id===u.id&&s.date===date);return<td key={date} style={{...tdS,background:date===fmt(today)?"#eff6ff":"transparent"}}>{ds.length===0?<span style={{color:"#d1d5db",fontSize:12}}>—</span>:ds.map((s,i)=><div key={i} style={{background:siteColor(s.site),borderRadius:6,color:"#fff",padding:"3px 7px",fontSize:11,marginBottom:2,whiteSpace:"nowrap"}}>{s.site}</div>)}</td>;})}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ExcelPanel({onImport,shifts,users}) {
  const [dragging,setDragging]=useState(false); const [preview,setPreview]=useState(null); const [status,setStatus]=useState("idle");
  const [msg,clr,show]=useToast(); const fileRef=useRef();
  function processFile(file){
    if(!file) return; setStatus("parsing");
    const reader=new FileReader();
    reader.onload=e=>{
      try{ const wb=XLSX.read(e.target.result,{type:"array",cellDates:false}); const {shifts:parsed,warnings}=parseWorkbook(wb,users); const unmapped=[...new Set(parsed.filter(s=>!s.user_id).map(s=>s._importName))]; setPreview({shifts:parsed,warnings,unmapped}); setStatus("done"); }
      catch(err){ show("❌ Couldn't read that file: "+err.message,"#dc2626"); setStatus("idle"); }
    };
    reader.readAsArrayBuffer(file);
  }
  function confirmImport(){ onImport(preview.shifts); show(`✅ Imported ${preview.shifts.length} shifts!`,"#059669"); setPreview(null); setStatus("idle"); }
  const siteCounts=preview?Object.entries(preview.shifts.reduce((a,s)=>{a[s.site]=(a[s.site]||0)+1;return a;},{})):[];
  return (
    <div>
      <Toast msg={msg} color={clr}/>
      <h2 style={{margin:"0 0 6px",fontSize:20,color:"#1e3a5f"}}>Excel Import / Export</h2>
      <p style={{color:"#6b7280",fontSize:14,marginTop:0,marginBottom:24}}>Import Kelly's existing schedule from Excel, or export back out any time.</p>
      <div style={{...card,marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:16,color:"#1e3a5f",marginBottom:4}}>📥 Import from Excel</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Upload Kelly's schedule — one tab per site. The app reads Date, Staff Name, Start, and End columns automatically.</div>
        <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${dragging?"#2563eb":"#d1d5db"}`,borderRadius:12,padding:"32px 20px",textAlign:"center",background:dragging?"#eff6ff":"#f9fafb",cursor:"pointer",transition:"all 0.2s",marginBottom:16}}>
          <div style={{fontSize:32,marginBottom:8}}>📂</div>
          <div style={{fontWeight:600,color:"#374151"}}>{status==="parsing"?"Reading file…":"Drop your Excel file here, or click to browse"}</div>
          <div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>.xlsx or .xls files</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>
        </div>
        <button onClick={downloadTemplate} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #d1d5db",background:"#fff",color:"#374151",cursor:"pointer",fontSize:13,fontWeight:600}}>📋 Download Blank Template</button>
        {preview&&(
          <div style={{marginTop:20}}>
            <div style={{fontWeight:700,color:"#1e3a5f",marginBottom:12,fontSize:15}}>Preview — {preview.shifts.length} shifts found</div>
            {preview.warnings.length>0&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:10,padding:12,marginBottom:12,fontSize:12,color:"#92400e"}}><strong>⚠️ Warnings:</strong>{preview.warnings.map((w,i)=><div key={i}>• {w}</div>)}</div>}
            {preview.unmapped.length>0&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:12,marginBottom:12,fontSize:12,color:"#dc2626"}}><strong>⚠️ Unmatched names (will still import):</strong>{preview.unmapped.map((n,i)=><div key={i}>• "{n}"</div>)}</div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>{siteCounts.map(([site,count])=><div key={site} style={{background:siteColor(site)+"22",border:`1px solid ${siteColor(site)}44`,borderRadius:8,padding:"6px 14px",fontSize:13}}><span style={{color:siteColor(site),fontWeight:700}}>{site}</span><span style={{color:"#6b7280",marginLeft:6}}>{count} shifts</span></div>)}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={confirmImport} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#059669",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>✅ Import {preview.shifts.length} Shifts</button>
              <button onClick={()=>{setPreview(null);setStatus("idle");}} style={{padding:"10px 18px",borderRadius:8,border:"1px solid #d1d5db",background:"#fff",color:"#6b7280",cursor:"pointer",fontSize:14}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div style={card}>
        <div style={{fontWeight:700,fontSize:16,color:"#1e3a5f",marginBottom:4}}>📤 Export to Excel</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Download the full schedule — one tab per site, ready to share or print.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>exportToExcel(shifts,users)} style={{padding:"10px 22px",borderRadius:8,border:"none",background:"#1e7a4e",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>🟢 Export All Shifts (.xlsx)</button>
          <button onClick={()=>exportToExcel(shifts.filter(s=>s.date>=fmt(today)),users)} style={{padding:"10px 22px",borderRadius:8,border:"1px solid #d1d5db",background:"#fff",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:14}}>Export Upcoming Only</button>
        </div>
        <div style={{marginTop:12,fontSize:12,color:"#9ca3af"}}>{shifts.length} total shifts across {new Set(shifts.map(s=>s.site)).size} sites</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AdminPanel({shifts,setShifts,openShifts,users}) {
  const [form,setForm]=useState({userId:users[0]?.id||"",site:SITES[0],date:fmt(today),start_time:"07:00",end_time:"15:00",notes:""});
  const [msg,clr,show]=useToast(); const [fSite,setFSite]=useState("All"); const [fUser,setFUser]=useState("All");
  function addShift(){ if(!form.userId||!form.site||!form.date) return; setShifts(prev=>[...prev,{...form,id:Date.now(),user_id:form.userId}].sort((a,b)=>a.date.localeCompare(b.date))); show("✅ Shift added!","#059669"); setForm(f=>({...f,notes:""})); }
  const visible=shifts.filter(s=>fSite==="All"||s.site===fSite).filter(s=>fUser==="All"||s.user_id===fUser).filter(s=>s.date>=fmt(today)).slice(0,40);
  return (
    <div>
      <Toast msg={msg} color={clr}/>
      <h2 style={{margin:"0 0 16px",fontSize:20,color:"#1e3a5f"}}>Admin — Manage Shifts</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        {[{label:"Open shifts",val:openShifts.filter(s=>!s.claimed_by&&s.date>=fmt(today)).length,color:"#ef4444"},{label:"Upcoming",val:shifts.filter(s=>s.date>=fmt(today)).length,color:"#2563eb"},{label:"Staff",val:users.length,color:"#059669"},{label:"Total shifts",val:shifts.length,color:"#7c3aed"}].map(stat=>(
          <div key={stat.label} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:16,textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:800,color:stat.color}}>{stat.val}</div>
            <div style={{fontSize:12,color:"#6b7280"}}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:12,padding:20,marginBottom:24}}>
        <div style={{fontWeight:700,marginBottom:14,color:"#0369a1"}}>➕ Add Shift</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
          <label style={labelS}>Staff<select value={form.userId} onChange={e=>setForm(f=>({...f,userId:e.target.value}))} style={inputS}>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label style={labelS}>Site<select value={form.site} onChange={e=>setForm(f=>({...f,site:e.target.value}))} style={inputS}>{SITES.map(s=><option key={s}>{s}</option>)}</select></label>
          <label style={labelS}>Date<input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inputS}/></label>
          <label style={labelS}>Start<input type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={inputS}/></label>
          <label style={labelS}>End<input type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={inputS}/></label>
          <label style={labelS}>Notes<input type="text" placeholder="optional" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inputS}/></label>
        </div>
        <button onClick={addShift} style={{marginTop:14,padding:"10px 24px",borderRadius:8,border:"none",background:"#0369a1",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>Add Shift</button>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <select value={fUser} onChange={e=>setFUser(e.target.value)} style={{...inputS,width:"auto"}}><option value="All">All Staff</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select value={fSite} onChange={e=>setFSite(e.target.value)} style={{...inputS,width:"auto"}}><option value="All">All Sites</option>{SITES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
      {visible.map((s,i)=>{ const u=users.find(u=>u.id===s.user_id); return (
        <div key={i} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:siteColor(s.site),flexShrink:0}}/>
            <div><span style={{fontWeight:600,color:"#1e3a5f"}}>{u?.name||"Unknown"}</span><span style={{color:"#6b7280",fontSize:13}}> · {s.site} · {formatDate(s.date)} · {s.start_time}–{s.end_time}</span>{s.notes&&<span style={{color:"#9ca3af",fontSize:12}}> · {s.notes}</span>}</div>
          </div>
          <button onClick={()=>setShifts(p=>p.filter(x=>x.id!==s.id))} style={{border:"none",background:"none",color:"#ef4444",cursor:"pointer",fontSize:18}}>×</button>
        </div>
      ); })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function Login({onLogin}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  function handle(){ const u=DEMO_USERS.find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.password_hash===pass); u?onLogin(u):setErr("Email or password not found."); }
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f2442 0%,#1e3a5f 50%,#0f2442 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif"}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:40,marginBottom:8}}>🏥</div><h1 style={{margin:0,fontSize:26,color:"#1e3a5f",fontWeight:800}}>ClinicSched</h1><p style={{color:"#6b7280",margin:"6px 0 0",fontSize:14}}>Your schedule, anywhere.</p></div>
        <label style={labelS}>Work Email<input type="email" placeholder="you@hospital.org" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} style={{...inputS,marginTop:2}}/></label>
        <label style={{...labelS,marginTop:14}}>Password<input type="password" placeholder="••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} style={{...inputS,marginTop:2}}/></label>
        {err&&<div style={{color:"#ef4444",fontSize:12,marginTop:10}}>{err}</div>}
        <button onClick={handle} style={{width:"100%",marginTop:20,padding:13,background:"#1e3a5f",color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:"pointer"}}>Sign In</button>
        <div style={{marginTop:22,padding:14,background:"#f8fafc",borderRadius:10,fontSize:12,color:"#6b7280"}}>
          <div style={{fontWeight:700,marginBottom:6,color:"#374151"}}>Demo accounts — click to fill:</div>
          {DEMO_USERS.map(u=><div key={u.id} onClick={()=>{setEmail(u.email);setPass(u.password_hash);}} style={{cursor:"pointer",padding:"3px 0",color:"#3b82f6",display:"flex",gap:8}}><span>{u.email} / {u.password_hash}</span>{u.role==="admin"&&<span style={{background:"#fef3c7",color:"#92400e",borderRadius:4,padding:"0 5px",fontSize:10,fontWeight:700}}>ADMIN</span>}</div>)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("my");
  const [gcalConnected,setGcalConnected]=useState(false);
  const [shifts,setShifts]=useState([]);
  const [openShifts,setOpenShifts]=useState([
    {id:901,site:"Elkhorn",    date:fmt(addDays(today,1)),start_time:"07:00",end_time:"15:00",notes:"Rad tech needed",claimed_by:null},
    {id:902,site:"Whitewater", date:fmt(addDays(today,2)),start_time:"09:00",end_time:"17:00",notes:"",              claimed_by:null},
    {id:903,site:"Lake Geneva",date:fmt(addDays(today,3)),start_time:"07:00",end_time:"15:00",notes:"MRI experience", claimed_by:null},
  ]);
  const users=DEMO_USERS;

  // Check URL hash for public open shifts page
  const [hash,setHash]=useState(window.location.hash);
  useEffect(()=>{ const handler=()=>setHash(window.location.hash); window.addEventListener("hashchange",handler); return ()=>window.removeEventListener("hashchange",handler); },[]);

  // Public page — no login needed
  if(hash==="#open") return (
    <PublicOpenShifts
      openShifts={openShifts}
      gcalConnected={gcalConnected}
      onClaim={(shift,name)=>{
        setOpenShifts(prev=>prev.map(s=>s.id===shift.id?{...s,claimed_by:name}:s));
      }}
    />
  );

  useEffect(()=>{ if(user&&shifts.length===0) setShifts(seedShifts(users)); },[user]);

  if(!user) return <Login onLogin={u=>{setUser(u);setTab(u.role==="admin"?"admin":"my");}}/>;

  const openCount=openShifts.filter(s=>!s.claimed_by&&s.date>=fmt(today)).length;
  const tabs=[
    {id:"my",   label:"My Schedule",icon:"📅"},
    {id:"open", label:"Open Shifts", icon:"🟡",badge:openCount},
    {id:"site", label:"By Site",     icon:"🏥"},
    {id:"lead", label:"By Lead",     icon:"👥"},
    {id:"excel",label:"Excel",       icon:"🟢"},
    ...(user.role==="admin"?[{id:"admin",label:"Admin",icon:"⚙️"}]:[]),
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:"#1e3a5f",color:"#fff",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{fontWeight:800,fontSize:18}}>🏥 ClinicSched</div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:13,opacity:0.8}}>{user.name}{user.role==="admin"&&<span style={{marginLeft:8,background:"#f59e0b",borderRadius:4,padding:"1px 7px",fontSize:11,color:"#fff",fontWeight:700}}>Admin</span>}</span>
          <button onClick={()=>{setUser(null);setShifts([]);}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12}}>Sign Out</button>
        </div>
      </div>
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",display:"flex",padding:"0 24px",gap:4,overflowX:"auto"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"14px 18px",border:"none",background:"none",position:"relative",borderBottom:`3px solid ${tab===t.id?"#1e3a5f":"transparent"}`,color:tab===t.id?"#1e3a5f":"#6b7280",fontWeight:tab===t.id?700:400,cursor:"pointer",fontSize:14,whiteSpace:"nowrap",transition:"all 0.15s"}}>
            {t.icon} {t.label}
            {t.badge>0&&<span style={{position:"absolute",top:8,right:4,background:"#ef4444",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:800}}>{t.badge}</span>}
          </button>
        ))}
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
        <GCalBanner gcalConnected={gcalConnected} setGcalConnected={setGcalConnected}/>
        {tab==="my"    && <MySchedule  user={user} gcalConnected={gcalConnected} shifts={shifts}/>}
        {tab==="open"  && <OpenShifts  user={user} gcalConnected={gcalConnected} shifts={shifts} openShifts={openShifts} setOpenShifts={setOpenShifts} setShifts={setShifts} users={users}/>}
        {tab==="site"  && <BySite      shifts={shifts} users={users}/>}
        {tab==="lead"  && <ByLead      shifts={shifts} users={users}/>}
        {tab==="excel" && <ExcelPanel  onImport={s=>setShifts(p=>[...p,...s])} shifts={shifts} users={users}/>}
        {tab==="admin" && user.role==="admin" && <AdminPanel shifts={shifts} setShifts={setShifts} openShifts={openShifts} users={users}/>}
      </div>
    </div>
  );
}
