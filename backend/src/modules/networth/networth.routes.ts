import type { FastifyInstance } from 'fastify';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';
import { historyQuerySchema } from './networth.schemas.js';
import { getHistory, getSummary } from './networth.service.js';

export async function networthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/summary', async (request) => getSummary(request.db));

  app.get('/history', async (request) => {
    const { range } = parse(historyQuerySchema, request.query);
    return getHistory(request.db, range);
  });
}
