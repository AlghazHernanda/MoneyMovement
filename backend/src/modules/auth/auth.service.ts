import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AppError, conflict, unauthorized } from '../../lib/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export type SessionDto = { accessToken: string; refreshToken: string; expiresAt?: number };
export type UserDto = { id: string; username: string; email: string; phone: string };

/** Dependency eksplisit supaya service bisa diuji tanpa Supabase asli. */
export type AuthDeps = {
  /** Client service role (bypass RLS). */
  admin: SupabaseClient;
  /** Factory client anon tanpa session, untuk sign-in & refresh. */
  createAnon: () => SupabaseClient;
};

const INVALID_LOGIN = 'Username atau password salah';

export function toSessionDto(session: Session): SessionDto {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
  };
}

export function createAuthService({ admin, createAnon }: AuthDeps) {
  async function signIn(email: string, password: string) {
    return createAnon().auth.signInWithPassword({ email, password });
  }

  return {
    async register(input: RegisterInput): Promise<{ user: UserDto; session: SessionDto }> {
      const { data: existing, error: lookupError } = await admin
        .from('profiles')
        .select('id')
        .eq('username', input.username)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) throw conflict('Username sudah dipakai', 'USERNAME_TAKEN');

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { username: input.username, phone: input.phone },
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

      const user: UserDto = {
        id: created.user.id,
        username: input.username,
        email: input.email,
        phone: input.phone,
      };

      const { error: profileError } = await admin.from('profiles').insert(user);
      if (profileError) {
        // Kompensasi: jangan tinggalkan auth user tanpa profile.
        await admin.auth.admin.deleteUser(user.id);
        if (profileError.code === '23505') {
          throw conflict('Username atau email sudah dipakai', 'DUPLICATE');
        }
        throw profileError;
      }

      const { data, error } = await signIn(input.email, input.password);
      if (error || !data.session) throw error ?? new Error('Gagal login otomatis');

      return { user, session: toSessionDto(data.session) };
    },

    async login(input: LoginInput): Promise<{ user: UserDto; session: SessionDto }> {
      const { data: profile, error } = await admin
        .from('profiles')
        .select('id, username, email, phone')
        .eq('username', input.username)
        .maybeSingle();
      if (error) throw error;
      // Pesan yang sama untuk username tidak ada & password salah (cegah enumerasi user).
      if (!profile) throw unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');

      const { data, error: signInError } = await signIn(profile.email, input.password);
      if (signInError || !data.session) throw unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');

      return { user: profile as UserDto, session: toSessionDto(data.session) };
    },

    async refresh(refreshToken: string): Promise<{ session: SessionDto }> {
      const { data, error } = await createAnon().auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        throw unauthorized('Sesi berakhir, silakan login ulang', 'REFRESH_FAILED');
      }
      return { session: toSessionDto(data.session) };
    },

    /** Profil milik user yang sedang login. `db` adalah client per-user (tunduk RLS). */
    async getProfile(db: SupabaseClient, userId: string) {
      const { data, error } = await db
        .from('profiles')
        .select('id, username, email, phone, created_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
