import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { createAnonClient, supabaseAdmin } from '../../lib/supabase.js';
import { AppError, conflict, unauthorized } from '../../lib/errors.js';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Username 3-30 karakter: huruf, angka, atau underscore');

const password = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter');

const registerSchema = z.object({
  username,
  email: z.string().trim().toLowerCase().pipe(z.email('Format email tidak valid')),
  phone: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, 'Nomor telepon tidak valid (contoh: 081234567890)'),
  password,
});

const loginSchema = z.object({
  username,
  password: z.string().min(1, 'Password wajib diisi'),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

function toSessionDto(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  };
}

const INVALID_LOGIN = 'Username atau password salah';

export async function authRoutes(app: FastifyInstance) {
  // Rate limit lebih ketat untuk endpoint kredensial (anti brute force).
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/register', strict, async (request, reply) => {
    const body = parse(registerSchema, request.body);

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', body.username)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) throw conflict('Username sudah dipakai', 'USERNAME_TAKEN');

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { username: body.username, phone: body.phone },
    });
    if (createError || !created.user) {
      if (createError?.code === 'email_exists' || createError?.status === 422) {
        throw conflict('Email sudah terdaftar', 'EMAIL_TAKEN');
      }
      if (createError?.code === 'weak_password') {
        throw new AppError(400, 'WEAK_PASSWORD', createError.message);
      }
      throw createError ?? new Error('Gagal membuat user');
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      username: body.username,
      email: body.email,
      phone: body.phone,
    });
    if (profileError) {
      // Kompensasi: jangan tinggalkan auth user tanpa profile.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      if (profileError.code === '23505') {
        throw conflict('Username atau email sudah dipakai', 'DUPLICATE');
      }
      throw profileError;
    }

    const { data: signIn, error: signInError } = await createAnonClient().auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (signInError || !signIn.session) throw signInError ?? new Error('Gagal login otomatis');

    return reply.status(201).send({
      user: { id: created.user.id, username: body.username, email: body.email, phone: body.phone },
      session: toSessionDto(signIn.session),
    });
  });

  app.post('/login', strict, async (request) => {
    const body = parse(loginSchema, request.body);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, email, phone')
      .eq('username', body.username)
      .maybeSingle();
    if (error) throw error;
    // Pesan yang sama untuk username tidak ada & password salah (cegah enumerasi user).
    if (!profile) throw unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');

    const { data, error: signInError } = await createAnonClient().auth.signInWithPassword({
      email: profile.email,
      password: body.password,
    });
    if (signInError || !data.session) throw unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');

    return { user: profile, session: toSessionDto(data.session) };
  });

  app.post('/refresh', strict, async (request) => {
    const body = parse(refreshSchema, request.body);
    const { data, error } = await createAnonClient().auth.refreshSession({
      refresh_token: body.refreshToken,
    });
    if (error || !data.session) throw unauthorized('Sesi berakhir, silakan login ulang', 'REFRESH_FAILED');
    return { session: toSessionDto(data.session) };
  });

  app.get('/me', { preHandler: authenticate }, async (request) => {
    const { data, error } = await request.db
      .from('profiles')
      .select('id, username, email, phone, created_at')
      .eq('id', request.userId)
      .single();
    if (error) throw error;
    return { user: data };
  });
}
