import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { unauthorized } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    /** Supabase client atas nama user, tunduk pada RLS. */
    db: SupabaseClient;
  }
}

/** preHandler: verifikasi Bearer token ke Supabase Auth lalu pasang client per-user. */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Header Authorization Bearer wajib diisi');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw unauthorized('Token kosong');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw unauthorized('Token tidak valid atau kedaluwarsa', 'TOKEN_INVALID');
  }

  request.userId = data.user.id;
  request.db = createUserClient(token);
}
