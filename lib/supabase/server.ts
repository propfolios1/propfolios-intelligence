import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Project URL; the Vercel Supabase integration sets SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL. */
export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

export const supabaseConfigured = () => Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);

let admin: SupabaseClient | undefined;

/**
 * Service-role client for Storage administration (buckets, uploads, signed
 * URLs). Bypasses RLS, so it is used only after the application layer has
 * checked the caller's tenant. Never sent to the browser.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  admin ??= createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
