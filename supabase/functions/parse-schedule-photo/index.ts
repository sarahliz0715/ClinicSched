// Photo-upload schedule digitization (Phase 3). Sends a photo of a
// handwritten/printed schedule to Claude's vision API and asks it to
// return the same {date, name, site_name, start_time, end_time, notes}
// shape the frontend's matchNamesAndSites() (src/lib/excel.js) expects —
// mirroring parseWorkbook()'s output so both import paths share one
// review-and-confirm UI (never auto-commits; the admin always reviews
// before anything is saved).
//
// Requires a Supabase secret `ANTHROPIC_API_KEY` — not set yet in this
// project. Calls 501 with a clear message until an admin adds one.
//
// Called via supabase.functions.invoke() from the app's own origin (a
// different origin than *.supabase.co), so the browser sends a CORS
// preflight OPTIONS request first. Without handling it and sending CORS
// headers on every response, that preflight 405s and the browser blocks
// the real POST before it ever reaches this function — surfaces in
// supabase-js as the generic "Failed to send a request to the Edge
// Function", not a clear CORS error. (Same fix already existed in
// public-open-shifts; this function and notify-open-shift were missing it.)
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";

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

const SYSTEM_PROMPT = `You read photos of handwritten or printed clinic staff schedules and extract structured shift data.

Return ONLY a JSON object (no markdown, no prose) shaped exactly like this:
{
  "shifts": [
    { "date": "2026-08-20", "name": "Sarah", "site_name": "Burlington", "start_time": "07:00", "end_time": "15:00", "notes": "" }
  ],
  "warnings": ["Row 3: couldn't read the start time, guessed 07:00."]
}

Rules:
- date must be YYYY-MM-DD. If the photo has no year, assume the nearest future occurrence of that month/day relative to today: ${new Date().toISOString().split("T")[0]}.
- name is the staff member's name as written (don't invent one).
- site_name is the clinic/site/column/tab label as written, if present; empty string if there's genuinely none.
- start_time/end_time in 24-hour HH:MM. If unreadable, make a reasonable guess and add a warning explaining it.
- One entry per person per shift, not per cell — if a whole week is a grid, emit one shift per person per day worked.
- If handwriting is ambiguous, still make your best guess and note the uncertainty in "warnings" rather than omitting the row.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "Photo import isn't set up yet — add an ANTHROPIC_API_KEY secret in Supabase to enable it." }, 501);
  }

  try {
    const { image_base64, media_type } = await req.json();
    if (!image_base64 || !media_type) return json({ error: "Missing image_base64 or media_type." }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: image_base64 } },
              { type: "text", text: "Extract every shift from this schedule photo as JSON." },
            ],
          },
        ],
      }),
    });

    if (!r.ok) return json({ error: `Claude API error: ${await r.text()}` }, 502);
    const data = await r.json();
    const text = data.content?.[0]?.text || "";

    let parsed;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : text);
    } catch {
      return json({ error: "Couldn't parse a response from the model. Try a clearer photo." }, 502);
    }

    return json({ shifts: parsed.shifts || [], warnings: parsed.warnings || [] });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
