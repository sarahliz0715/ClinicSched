import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { fmt, today } from "../lib/dates";
import { card } from "../lib/ui";
import { parseWorkbook, matchNamesAndSites, exportToExcel, downloadTemplate } from "../lib/excel";
import { createShifts, parseSchedulePhoto } from "../lib/api";
import { Toast, useToast } from "../components/Shared";

function ImportPreview({ preview, onConfirm, onCancel, sites }) {
  const siteCounts = Object.entries(preview.shifts.reduce((a, s) => {
    const name = sites.find(x => x.id === s.site_id)?.name || "Unknown";
    a[name] = (a[name] || 0) + 1;
    return a;
  }, {}));
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: 12, fontSize: 15 }}>Preview — {preview.shifts.length} shifts found. Review before importing.</div>
      {preview.warnings.length > 0 && <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, color: "#92400e" }}><strong>⚠️ Warnings:</strong>{preview.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div>}
      {preview.unmapped.length > 0 && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, color: "#dc2626" }}><strong>⚠️ Unmatched names:</strong>{preview.unmapped.map((n, i) => <div key={i}>• "{n}"</div>)}</div>}
      <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#f8fafc" }}>{["Date", "Name", "Site", "Start", "End", "Notes"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>)}</tr></thead>
          <tbody>
            {preview.shifts.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 10px" }}>{s.date}</td>
                <td style={{ padding: "6px 10px", color: s.staff_id ? "#111827" : "#dc2626" }}>{s._importName}</td>
                <td style={{ padding: "6px 10px" }}>{sites.find(x => x.id === s.site_id)?.name}</td>
                <td style={{ padding: "6px 10px" }}>{s.start_time}</td>
                <td style={{ padding: "6px 10px" }}>{s.end_time}</td>
                <td style={{ padding: "6px 10px", color: "#6b7280" }}>{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{siteCounts.map(([name, count]) => <div key={name} style={{ background: "#e5e7eb44", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", fontSize: 13 }}><span style={{ fontWeight: 700 }}>{name}</span><span style={{ color: "#6b7280", marginLeft: 6 }}>{count} shifts</span></div>)}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onConfirm} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✅ Import {preview.shifts.length} Shifts</button>
        <button onClick={onCancel} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}

export default function ExcelPanel({ shifts, sites, staff, onRefresh }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [photoStatus, setPhotoStatus] = useState("idle");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoErr, setPhotoErr] = useState("");
  const [msg, clr, show] = useToast();
  const fileRef = useRef();
  const photoRef = useRef();

  function withUnmapped(shifts, warnings) {
    return { shifts, warnings, unmapped: [...new Set(shifts.filter(s => !s.staff_id).map(s => s._importName))] };
  }

  function processFile(file) {
    if (!file) return;
    setStatus("parsing");
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const { shifts: parsed, warnings } = parseWorkbook(wb, sites, staff);
        setPreview(withUnmapped(parsed, warnings));
        setStatus("done");
      } catch (err) {
        show("❌ Couldn't read that file: " + err.message, "#dc2626");
        setStatus("idle");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processPhoto(file) {
    if (!file) return;
    setPhotoStatus("reading");
    setPhotoErr("");
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const dataUrl = e.target.result;
        const [, mediaType, base64] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) || [];
        if (!base64) throw new Error("Couldn't read that image.");
        setPhotoStatus("parsing");
        const { shifts: raw, warnings: ocrWarnings } = await parseSchedulePhoto({ imageBase64: base64, mediaType });
        const { shifts: matched, warnings: matchWarnings } = matchNamesAndSites(raw, sites, staff);
        setPhotoPreview(withUnmapped(matched, [...ocrWarnings, ...matchWarnings]));
        setPhotoStatus("done");
      } catch (err) {
        setPhotoErr(err.message);
        setPhotoStatus("idle");
      }
    };
    reader.readAsDataURL(file);
  }

  async function confirmImport(previewData, setter) {
    try {
      const rows = previewData.shifts.map(({ _importName, ...rest }) => rest);
      await createShifts(rows);
      show(`✅ Imported ${previewData.shifts.length} shifts!`, "#059669");
      setter(null);
      onRefresh();
    } catch (e) {
      show("❌ " + e.message, "#dc2626");
    }
  }

  return (
    <div>
      <Toast msg={msg} color={clr} />
      <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#1e3a5f" }}>Import / Export</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0, marginBottom: 24 }}>Import an existing schedule from Excel or a photo, or export back out any time.</p>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f", marginBottom: 4 }}>📥 Import from Excel</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Upload a schedule — one tab per site, tab name matching a site you've set up. The app reads Date, Staff Name, Start, and End columns automatically.</div>
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }} onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${dragging ? "#2563eb" : "#d1d5db"}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", background: dragging ? "#eff6ff" : "#f9fafb", cursor: "pointer", transition: "all 0.2s", marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>{status === "parsing" ? "Reading file…" : "Drop your Excel file here, or click to browse"}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>.xlsx or .xls files</div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
        </div>
        <button onClick={() => downloadTemplate(sites)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>📋 Download Blank Template</button>
        {preview && <ImportPreview preview={preview} sites={sites} onConfirm={() => confirmImport(preview, setPreview)} onCancel={() => { setPreview(null); setStatus("idle"); }} />}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f", marginBottom: 4 }}>📷 Import from a Photo</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Snap a photo of a handwritten or printed schedule — Claude reads it and proposes shifts for you to review before anything is saved.</div>
        <div onClick={() => photoRef.current.click()} style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: "32px 20px", textAlign: "center", background: "#f9fafb", cursor: "pointer", marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>
            {photoStatus === "reading" ? "Reading photo…" : photoStatus === "parsing" ? "Asking Claude to read it…" : "Click to choose a photo"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>.jpg or .png</div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => processPhoto(e.target.files[0])} />
        </div>
        {photoErr && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 12, fontSize: 12, color: "#dc2626" }}>❌ {photoErr}</div>}
        {photoPreview && <ImportPreview preview={photoPreview} sites={sites} onConfirm={() => confirmImport(photoPreview, setPhotoPreview)} onCancel={() => { setPhotoPreview(null); setPhotoStatus("idle"); }} />}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f", marginBottom: 4 }}>📤 Export to Excel</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Download the full schedule — one tab per site, ready to share or print.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => exportToExcel(shifts, sites)} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#1e7a4e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🟢 Export All Shifts (.xlsx)</button>
          <button onClick={() => exportToExcel(shifts.filter(s => s.date >= fmt(today)), sites)} style={{ padding: "10px 22px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Export Upcoming Only</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>{shifts.length} total shifts across {new Set(shifts.map(s => s.site_id)).size} sites</div>
      </div>
    </div>
  );
}
