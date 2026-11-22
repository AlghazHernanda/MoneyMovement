import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';
import { notFound } from '../../lib/errors.js';

const MAX_BALANCE = 1_000_000_000_000_000; // 1 kuadriliun IDR, di bawah batas numeric(18,2)

const assetType = z.enum(['cash', 'investment']);
const balance = z
  .number({ error: 'Saldo harus berupa angka' })
  .finite()
  .min(0, 'Saldo tidak boleh negatif')
  .max(MAX_BALANCE, 'Saldo terlalu besar')
  .transform((v) => Math.round(v * 100) / 100);

const createSchema = z.object({
  type: assetType,
  name: z.string().trim().min(1, 'Nama wajib diisi').max(60),
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(40),
  balance,
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    balance: balance.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Minimal satu field harus diubah');

const listQuery = z.object({ type: assetType.optional() });
const idParams = z.object({ id: z.uuid('ID tidak valid') });

const COLUMNS = 'id, type, name, category, balance, created_at, updated_at';

type AssetRow = { balance: number | string } & Record<string, unknown>;
const toDto = (row: AssetRow) => ({ ...row, balance: Number(row.balance) });

export async function assetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const { type } = parse(listQuery, request.query);
    let query = request.db.from('assets').select(COLUMNS).order('created_at', { ascending: true });
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return { items: (data ?? []).map(toDto) };
  });

  app.post('/', async (request, reply) => {
    const body = parse(createSchema, request.body);
    const { data, error } = await request.db
      .from('assets')
      .insert({ ...body, user_id: request.userId })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return reply.status(201).send({ item: toDto(data) });
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const body = parse(updateSchema, request.body);
    const { data, error } = await request.db
      .from('assets')
      .update(body)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('Aset tidak ditemukan');
    return { item: toDto(data) };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const { data, error } = await request.db
      .from('assets')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('Aset tidak ditemukan');
    return reply.status(204).send();
  });
}
