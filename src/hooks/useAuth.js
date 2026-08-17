import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchMyProfile } from "../lib/api";

// Tracks the Supabase auth session plus the signed-in user's `staff` row
// (which carries their organization + role). `profile` is null both while
// loading AND for an authenticated user who hasn't finished onboarding yet
// (no staff row) — check `loading` to tell those apart.
export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await fetchMyProfile();
      setProfile(p);
      setProfileError(null);
      return p;
    } catch (e) {
      setProfileError(e.message);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await refreshProfile();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  return { loading, session, profile, profileError, refreshProfile, isAdmin: profile?.role === "admin" };
}
