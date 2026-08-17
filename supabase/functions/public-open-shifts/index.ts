// Public (unauthenticated) open-shift claim endpoint.
//
// Deliberately NOT implemented as raw RLS-permitted anon table access: the
// org's `public_share_token` is the only thing standing between "anyone
// with the shareable link" and "anyone at all", and Postgres RLS has no
// clean way to check a value that only lives in a URL query param. This
// function does that check itself (service role, own validation) instead —
// same security property the brief asked for, simpler to get right.
//
// GET  ?token=<org public_share_token>            -> list open shifts
// POST { token, shift_id, claimer_name }           -> claim one
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function resolveOrg(token: string | null) {
  if (!token) return null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("public_share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      const org = await resolveOrg(token);
      if (!org) return json({ error: "This link isn't valid. Ask your admin for a fresh one." }, 404);

      const todayStr = new Date().toISOString().split("T")[0];
      const { data: shifts, error } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, notes, site:sites(name, color)")
        .eq("organization_id", org.id)
        .eq("status", "open")
        .gte("date", todayStr)
        .order("date");
      if (error) return json({ error: error.message }, 500);

      return json({
        organization_name: org.name,
        shifts: (shifts || []).map((s) => ({
          id: s.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          notes: s.notes,
          site_name: s.site?.name,
          site_color: s.site?.color,
        })),
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { token, shift_id, claimer_name } = body || {};
      if (!shift_id || !claimer_name?.trim()) return json({ error: "Missing shift or name." }, 400);

      const org = await resolveOrg(token);
      if (!org) return json({ error: "This link isn't valid. Ask your admin for a fresh one." }, 404);

      const { data: updated, error } = await supabase
        .from("shifts")
        .update({ status: "claimed", claimed_by_name: claimer_name.trim() })
        .eq("id", shift_id)
        .eq("organization_id", org.id)
        .eq("status", "open")
        .select("id, date, start_time, end_time, notes, site:sites(name)")
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!updated) return json({ error: "That shift was already claimed by someone else." }, 409);

      return json({
        id: updated.id,
        date: updated.date,
        start_time: updated.start_time,
        end_time: updated.end_time,
        notes: updated.notes,
        site_name: updated.site?.name,
      });
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
