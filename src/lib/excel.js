import * as XLSX from "xlsx";
import { fmt } from "./dates";

// ── Excel helpers ────────────────────────────────────────────────────────
// Flexible column-header matching kept exactly as it was in the original
// single-file prototype — this logic is the reusable asset, only the data
// it reads/writes changed (real `sites`/`staff` from the DB instead of
// hardcoded arrays).

export function parseTime(val) {
  if (!val && val !== 0) return "07:00";
  if (typeof val === "string") {
    const m = val.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
    const am = val.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (am) {
      let h = parseInt(am[1]);
      if (am[3] === "pm" && h !== 12) h += 12;
      if (am[3] === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${am[2] || "00"}`;
    }
    return "07:00";
  }
  if (typeof val === "number") {
    const tot = Math.round(val * 24 * 60);
    return `${String(Math.floor(tot / 60) % 24).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;
  }
  return "07:00";
}

export function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return fmt(val);
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const us = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) return `${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
  }
  return null;
}

// Drops same-staff/same-date duplicates within one import batch (keeping
// the first occurrence) instead of letting the whole batch insert fail
// against the DB's shifts_staff_date_unique constraint on one bad row.
// Only applies to rows with a matched staff_id — an unmatched name isn't
// actually a known staff member yet, so there's nothing to double-book.
function flagDoubleBookings(shifts, warnings) {
  const seen = new Set();
  const deduped = [];
  shifts.forEach((s, i) => {
    if (!s.staff_id) { deduped.push(s); return; }
    const key = `${s.staff_id}|${s.date}`;
    if (seen.has(key)) {
      warnings.push(`Row ${i + 1}: ${s._importName} is already scheduled on ${s.date} elsewhere in this import — skipped to avoid double-booking.`);
      return;
    }
    seen.add(key);
    deduped.push(s);
  });
  return deduped;
}

// sites: [{id, name}], knownStaff: [{id, name}]
export function parseWorkbook(wb, sites, knownStaff) {
  const shifts = [], warnings = [];
  wb.SheetNames.forEach(sheetName => {
    const site = sites.find(s => sheetName.trim().toLowerCase().includes(s.name.toLowerCase()));
    if (!site) {
      warnings.push(`Sheet "${sheetName}": no matching site found. Create a site with this name first, then re-import. Skipped.`);
      return;
    }
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (rows.length < 2) return;
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (rows[i].filter(Boolean).length > 1) { headerIdx = i; break; }
    }
    const headers = rows[headerIdx].map(h => String(h).toLowerCase().trim());
    const col = key => {
      const syn = {
        date: ["date", "day", "shift date", "work date"],
        name: ["name", "staff", "employee", "person", "tech", "worker", "staff name"],
        start: ["start", "start time", "begin", "from", "time in"],
        end: ["end", "end time", "finish", "to", "time out"],
        notes: ["notes", "note", "comments"],
      };
      return headers.findIndex(h => (syn[key] || [key]).some(s => h.includes(s)));
    };
    const dateCol = col("date"), nameCol = col("name"), startCol = col("start"), endCol = col("end"), notesCol = col("notes");
    if (dateCol < 0 || nameCol < 0) {
      warnings.push(`Sheet "${sheetName}": couldn't find Date/Name columns. Skipped.`);
      return;
    }
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r], rawDate = row[dateCol], rawName = String(row[nameCol] || "").trim();
      if (!rawDate || !rawName) continue;
      const date = parseDate(rawDate);
      if (!date) { warnings.push(`Row ${r + 1} on "${sheetName}": unreadable date.`); continue; }
      const staff = knownStaff.find(u =>
        u.name.toLowerCase() === rawName.toLowerCase() ||
        u.name.toLowerCase().startsWith(rawName.toLowerCase().split(" ")[0])
      );
      shifts.push({
        _importName: rawName,
        site_id: site.id,
        staff_id: staff?.id || null,
        date,
        start_time: startCol >= 0 ? parseTime(row[startCol]) : "07:00",
        end_time: endCol >= 0 ? parseTime(row[endCol]) : "15:00",
        notes: notesCol >= 0 ? String(row[notesCol] || "").trim() : "",
        status: "assigned",
      });
    }
  });
  return { shifts: flagDoubleBookings(shifts, warnings), warnings };
}

// shifts: joined rows with .site (name) and .staff (name), sites: [{id,name}]
// Takes loosely-structured rows (as returned by the photo-OCR edge function:
// free-text date/name/site strings) and matches them against real sites and
// staff the same way parseWorkbook() does for Excel imports, so both import
// paths feed the same review-and-confirm UI.
export function matchNamesAndSites(rawRows, sites, knownStaff) {
  const shifts = [], warnings = [];
  rawRows.forEach((row, i) => {
    const rawDate = row.date, rawName = String(row.name || "").trim(), rawSite = String(row.site_name || "").trim();
    if (!rawDate || !rawName) { warnings.push(`Row ${i + 1}: missing date or name, skipped.`); return; }
    const date = parseDate(rawDate) || (/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null);
    if (!date) { warnings.push(`Row ${i + 1}: unreadable date "${rawDate}", skipped.`); return; }
    const site = sites.find(s => s.name.toLowerCase() === rawSite.toLowerCase() || rawSite.toLowerCase().includes(s.name.toLowerCase()));
    if (!site) { warnings.push(`Row ${i + 1}: no site matching "${rawSite}", skipped. Create that site first, then re-import.`); return; }
    const staff = knownStaff.find(u =>
      u.name.toLowerCase() === rawName.toLowerCase() ||
      u.name.toLowerCase().startsWith(rawName.toLowerCase().split(" ")[0])
    );
    shifts.push({
      _importName: rawName,
      site_id: site.id,
      staff_id: staff?.id || null,
      date,
      start_time: row.start_time ? parseTime(row.start_time) : "07:00",
      end_time: row.end_time ? parseTime(row.end_time) : "15:00",
      notes: String(row.notes || "").trim(),
      status: "assigned",
    });
  });
  return { shifts: flagDoubleBookings(shifts, warnings), warnings };
}

export function exportToExcel(shifts, sites) {
  const wb = XLSX.utils.book_new();
  sites.forEach(site => {
    const rows = [["Date", "Staff Name", "Start", "End", "Notes"]];
    shifts.filter(s => s.site_id === site.id).sort((a, b) => a.date.localeCompare(b.date))
      .forEach(s => { rows.push([s.date, s.staff?.name || s._importName || "Unknown", s.start_time, s.end_time, s.notes || ""]); });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, site.name.substring(0, 31));
  });
  XLSX.writeFile(wb, "ClinicSched-Export.xlsx");
}

export function downloadTemplate(sites) {
  const wb = XLSX.utils.book_new();
  (sites.length ? sites : [{ name: "Site1" }]).forEach(site => {
    const rows = [
      ["Date", "Staff Name", "Start Time", "End Time", "Notes"],
      ["2026-06-15", "Sarah", "07:00", "15:00", ""],
      ["2026-06-15", "Mindy", "07:00", "15:00", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, site.name.substring(0, 31));
  });
  XLSX.writeFile(wb, "ClinicSched-Template.xlsx");
}
