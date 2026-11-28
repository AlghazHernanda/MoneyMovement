import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { ValidationError } from './gateway/validate.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { assetRoutes } from './modules/assets/assets.routes.js';
import { networthRoutes } from './modules/networth/networth.routes.js';

/**
 * API Gateway: satu entry point untuk semua modul.
 * Tanggung jawab gateway: security header, CORS, rate limit, auth, validasi, error handling, routing.
 */
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
    },
    bodyLimit: 16 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    if (error instanceof ValidationError) {
      return reply
        .status(400)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    const status = (error as FastifyError).statusCode;
    if (status && status < 500) {
      return reply
        .status(status)
        .send({ error: { code: 'REQUEST_ERROR', message: error.message } });
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply
      .status(404)
      .send({ error: { code: 'ROUTE_NOT_FOUND', message: 'Endpoint tidak ditemukan' } }),
  );

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(assetRoutes, { prefix: '/assets' });
      await api.register(networthRoutes, { prefix: '/networth' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
