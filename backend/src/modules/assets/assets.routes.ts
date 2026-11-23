import type { FastifyInstance } from 'fastify';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';
import {
  assetIdParams,
  balanceChangesQuery,
  createAssetSchema,
  listAssetsQuery,
  updateAssetSchema,
  updateBalanceSchema,
} from './assets.schemas.js';
import * as assets from './assets.service.js';

export async function assetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const { type } = parse(listAssetsQuery, request.query);
    return { items: await assets.listAssets(request.db, type) };
  });

  app.post('/', async (request, reply) => {
    const input = parse(createAssetSchema, request.body);
    return reply.status(201).send({ item: await assets.createAsset(request.db, request.userId, input) });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(assetIdParams, request.params);
    const input = parse(updateAssetSchema, request.body);
    return { item: await assets.updateAsset(request.db, id, input) };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = parse(assetIdParams, request.params);
    await assets.deleteAsset(request.db, id);
    return reply.status(204).send();
  });

  /** Update saldo: set saldo baru, catat selisih + timestamp. */
  app.post('/:id/balance', async (request) => {
    const { id } = parse(assetIdParams, request.params);
    const { balance } = parse(updateBalanceSchema, request.body);
    return assets.updateBalance(request.db, id, balance);
  });

  /** Riwayat perubahan saldo, terbaru di atas. */
  app.get('/:id/balance-changes', async (request) => {
    const { id } = parse(assetIdParams, request.params);
    const { limit } = parse(balanceChangesQuery, request.query);
    return { items: await assets.listBalanceChanges(request.db, id, limit) };
  });
}
