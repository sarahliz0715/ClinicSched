import { supabase } from "./supabaseClient";

// ── Auth ─────────────────────────────────────────────────────────────────
export async function signUp({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Creates a brand-new organization and makes the current authenticated user
// its first admin. Must be called right after signUp() succeeds.
export async function createOrganization({ orgName, adminName }) {
  const { data, error } = await supabase.rpc("signup_organization", { org_name: orgName, admin_name: adminName });
  if (error) throw error;
  return data; // new organization id
}

// Links the current authenticated user to a pending staff invite row.
export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc("accept_staff_invite", { token });
  if (error) throw error;
  return data; // organization id
}

// Loads the staff profile (role, org, name) for the signed-in user.
export async function fetchMyProfile() {
  const { data, error } = await supabase
    .from("staff")
    .select("*, organization:organizations(*)")
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // no rows — not linked to an org yet
    throw error;
  }
  return data;
}

// ── Sites ────────────────────────────────────────────────────────────────
export async function fetchSites() {
  const { data, error } = await supabase.from("sites").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function createSite({ name, color }) {
  const { data, error } = await supabase.from("sites").insert({ name, color }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSite(id, patch) {
  const { data, error } = await supabase.from("sites").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSite(id) {
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) throw error;
}

// ── Staff ────────────────────────────────────────────────────────────────
export async function fetchStaff() {
  const { data, error } = await supabase.from("staff").select("*").order("name");
  if (error) throw error;
  return data;
}

// Creates a pending invite row (auth_user_id is null until the invitee
// signs up and calls acceptInvite with the returned invite_token).
export async function inviteStaff({ name, email, role, lead }) {
  const { data, error } = await supabase
    .from("staff")
    .insert({ name, email, role, lead })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStaff(id, patch) {
  const { data, error } = await supabase.from("staff").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteStaff(id) {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) throw error;
}

// ── Shifts ───────────────────────────────────────────────────────────────
const SHIFT_SELECT = "*, site:sites(*), staff:staff(*)";

export async function fetchShifts() {
  const { data, error } = await supabase.from("shifts").select(SHIFT_SELECT).order("date");
  if (error) throw error;
  return data;
}

export async function createShift(shift) {
  const { data, error } = await supabase.from("shifts").insert(shift).select(SHIFT_SELECT).single();
  if (error) throw error;
  return data;
}

export async function createShifts(shifts) {
  if (!shifts.length) return [];
  const { data, error } = await supabase.from("shifts").insert(shifts).select(SHIFT_SELECT);
  if (error) throw error;
  return data;
}

export async function updateShift(id, patch) {
  const { data, error } = await supabase.from("shifts").update(patch).eq("id", id).select(SHIFT_SELECT).single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id) {
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

// A logged-in staff member claims one of their org's open shifts for themselves.
export async function claimShiftForSelf(shiftId, staffId) {
  const { data, error } = await supabase
    .from("shifts")
    .update({ staff_id: staffId, status: "assigned" })
    .eq("id", shiftId)
    .eq("status", "open")
    .select(SHIFT_SELECT)
    .single();
  if (error) throw error;
  return data;
}

// ── Public (unauthenticated) open-shift claim page ──────────────────────
// Goes through the public-open-shifts edge function rather than direct
// table access — the function validates the org's public_share_token
// server-side instead of relying on RLS being able to see a URL param.
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-open-shifts`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function publicFetchOpenShifts(token) {
  const r = await fetch(`${FUNCTIONS_URL}?token=${encodeURIComponent(token)}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Couldn't load open shifts.");
  return body;
}

export async function publicClaimShift({ token, shiftId, claimerName }) {
  const r = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ token, shift_id: shiftId, claimer_name: claimerName }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Couldn't claim that shift — someone may have already taken it.");
  return body;
}

// ── Email notification for a newly-posted open shift (Phase 4) ──────────
export async function notifyStaffOfOpenShift(shiftId) {
  const { data, error } = await supabase.functions.invoke("notify-open-shift", {
    body: { shift_id: shiftId },
  });
  if (error) throw error;
  return data;
}

// ── Photo-upload schedule OCR (Phase 3) ──────────────────────────────────
// imageBase64 should be a raw base64 payload (no data: prefix), mediaType
// e.g. "image/jpeg" or "image/png".
export async function parseSchedulePhoto({ imageBase64, mediaType }) {
  const { data, error } = await supabase.functions.invoke("parse-schedule-photo", {
    body: { image_base64: imageBase64, media_type: mediaType },
  });
  if (error) throw error;
  return data; // { shifts: [...], warnings: [...] } — same shape as parseWorkbook()
}
