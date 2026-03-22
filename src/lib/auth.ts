import { supabase } from "@/integrations/supabase/client";

const AUTH_TOKEN_KEY = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;

export async function logoutUser() {
  const { error } = await supabase.auth.signOut({ scope: "local" });

  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // no-op
  }

  return { error };
}
