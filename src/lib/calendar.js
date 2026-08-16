// ── Google Calendar / .ics export ──────────────────────────────────────────
// Unchanged from the original prototype — receives real shift data now.

export function buildGCalUrl(shift, siteName, userName) {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const d = shift.date.replace(/-/g, ""), st = (shift.start_time || "07:00").replace(":", ""), en = (shift.end_time || "15:00").replace(":", "");
  return `${base}&text=${encodeURIComponent(`${siteName} — ${userName}`)}&dates=${d}T${st}00/${d}T${en}00&details=${encodeURIComponent(`Clinic shift at ${siteName}\n${shift.start_time}–${shift.end_time}${shift.notes ? "\n" + shift.notes : ""}`)}&sf=true&output=xml`;
}

export function exportICS(shifts, userName, siteNameFor) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClinicSched//EN", "CALSCALE:GREGORIAN"];
  shifts.forEach(s => {
    const dt = s.date.replace(/-/g, "");
    const siteName = siteNameFor ? siteNameFor(s) : s.site?.name || "Shift";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dt}T${(s.start_time || "07:00").replace(":", "")}00`,
      `DTEND:${dt}T${(s.end_time || "15:00").replace(":", "")}00`,
      `SUMMARY:${siteName} — ${userName}`,
      s.notes ? `DESCRIPTION:${s.notes}` : "",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "my-schedule.ics";
  a.click();
}
