// Emails an org's staff when an admin posts a new open shift (Phase 4).
// Requires a Supabase secret `RESEND_API_KEY` (and optionally
// `RESEND_FROM_EMAIL`, `APP_PUBLIC_URL`) — neither is set yet in this
// project, so calls will 501 with a clear message until an admin adds them
// (Supabase dashboard → Edge Functions → Secrets). The frontend already
// treats that failure as non-fatal (the shift still gets posted).
//
// Called authenticated (verify_jwt stays on) via supabase.functions.invoke
// from the app — RLS on the underlying tables (queried with the caller's
// own JWT, not service role) is what keeps this scoped to the caller's org.
//
// Called from the app's own origin (a different origin than *.supabase.co),
// so the browser sends a CORS preflight OPTIONS request first. Without
// handling it and sending CORS headers on every response, that preflight
// 405s and the browser blocks the real POST before it ever reaches this
// function — surfaces in supabase-js as the generic "Failed to send a
// request to the Edge Function", not a clear CORS error.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
const APP_PUBLIC_URL = Deno.env.get("APP_PUBLIC_URL") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!RESEND_API_KEY) {
    return json({ error: "Email isn't set up yet — add a RESEND_API_KEY secret in Supabase to enable notifications." }, 501);
  }

  try {
    const { shift_id } = await req.json();
    if (!shift_id) return json({ error: "Missing shift_id." }, 400);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { data: shift, error: shiftErr } = await userClient
      .from("shifts")
      .select("id, date, start_time, end_time, notes, organization_id, site:sites(name)")
      .eq("id", shift_id)
      .single();
    if (shiftErr || !shift) return json({ error: shiftErr?.message || "Shift not found." }, 404);

    const { data: org } = await userClient
      .from("organizations")
      .select("name, public_share_token")
      .eq("id", shift.organization_id)
      .single();

    const { data: staffRows } = await userClient
      .from("staff")
      .select("email, role")
      .eq("organization_id", shift.organization_id);

    const recipients = (staffRows || []).filter((s) => s.role === "staff").map((s) => s.email);
    if (!recipients.length) return json({ sent: 0 });

    const claimUrl = `${APP_PUBLIC_URL}/#open/${org?.public_share_token || ""}`;
    const siteName = shift.site?.name || "your clinic";
    const subject = `Open shift at ${siteName} — ${shift.date}`;
    const html = `
      <p>A new open shift needs coverage at <strong>${org?.name || "your clinic"}</strong>:</p>
      <p><strong>${siteName}</strong><br/>${shift.date}, ${shift.start_time}–${shift.end_time}${shift.notes ? `<br/>${shift.notes}` : ""}</p>
      <p><a href="${claimUrl}">Click here to claim this shift</a> — no login needed.</p>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: recipients, subject, html }),
    });
    if (!r.ok) return json({ error: await r.text() }, 502);

    return json({ sent: recipients.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
