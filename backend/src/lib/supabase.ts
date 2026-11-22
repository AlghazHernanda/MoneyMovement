import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * Admin client (service role). Bypass RLS, jadi HANYA dipakai untuk operasi
 * yang memang butuh hak admin: membuat user, lookup email dari username.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  noSession,
);

/** Client anon tanpa user, dipakai untuk sign-in dan refresh token. */
export function createAnonClient(): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, noSession);
}

/**
 * Client yang bertindak atas nama user (membawa JWT user),
 * sehingga semua query tunduk pada Row Level Security.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
