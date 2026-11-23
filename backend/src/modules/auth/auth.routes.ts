import type { FastifyInstance } from 'fastify';
import { createAnonClient, supabaseAdmin } from '../../lib/supabase.js';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import { createAuthService, type AuthService } from './auth.service.js';

export type AuthRoutesOptions = { service?: AuthService };

export async function authRoutes(app: FastifyInstance, opts: AuthRoutesOptions = {}) {
  const service = opts.service ?? createAuthService({ admin: supabaseAdmin, createAnon: createAnonClient });

  // Rate limit lebih ketat untuk endpoint kredensial (anti brute force).
  const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/register', strict, async (request, reply) => {
    const input = parse(registerSchema, request.body);
    return reply.status(201).send(await service.register(input));
  });

  app.post('/login', strict, async (request) => {
    const input = parse(loginSchema, request.body);
    return service.login(input);
  });

  app.post('/refresh', strict, async (request) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    return service.refresh(refreshToken);
  });

  app.get('/me', { preHandler: authenticate }, async (request) => {
    return { user: await service.getProfile(request.db, request.userId) };
  });
}
