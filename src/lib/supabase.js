import { createClient } from "@supabase/supabase-js";

// Accept the URL however it was copied from Supabase: Settings shows it
// with "/rest/v1/" on the end in some places, and the client adds that
// itself. Keep only the https://<project>.supabase.co part.
const url = (import.meta.env.VITE_SUPABASE_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/(rest|auth)\/v1$/, "")
  .replace(/\/+$/, "");
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// The app renders a setup screen instead of crashing when these are missing.
export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
