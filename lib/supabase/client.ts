import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const browserSupabaseConfigured = () => Boolean(url && anonKey);

let client: SupabaseClient | undefined;

/**
 * Browser client. Authenticates every request and the Realtime socket with the
 * signed-in user's Clerk session token, which Supabase trusts as a third-party
 * issuer; row-level security then limits each query to the user's tenant (and,
 * for clients, to their own records). Holds only the public anon key.
 */
export function browserSupabase(getToken: () => Promise<string | null>): SupabaseClient | null {
  if (!browserSupabaseConfigured()) return null;
  client ??= createClient(url, anonKey, { accessToken: async () => (await getToken()) ?? "" });
  return client;
}
