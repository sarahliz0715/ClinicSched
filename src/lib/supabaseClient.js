import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Deliberately NOT overridable by a VITE_APP_PUBLIC_URL env var: invite and
// open-shift links must always point at whatever domain is actually serving
// the app right now (a preview deployment, production, wherever) — a static
// env var value is correct for exactly one of those and silently wrong for
// every other one. A preview build previously baked in the production
// domain this way, sending an invited staff member to the old prototype's
// login screen instead of the real invite flow on the branch it was
// actually created on.
export const APP_PUBLIC_URL = window.location.origin;
