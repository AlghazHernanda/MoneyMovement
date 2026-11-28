import { z } from 'zod';

const MAX_BALANCE = 1_000_000_000_000_000; // 1 kuadriliun IDR, di bawah batas numeric(18,2)

export const assetType = z.enum(['cash', 'investment', 'liability']);

const balance = z
  .number({ error: 'Saldo harus berupa angka' })
  .finite()
  .min(0, 'Saldo tidak boleh negatif')
  .max(MAX_BALANCE, 'Saldo terlalu besar')
  .transform((v) => Math.round(v * 100) / 100);

export const createAssetSchema = z.object({
  type: assetType,
  name: z.string().trim().min(1, 'Nama wajib diisi').max(60),
  category: z.string().trim().min(1, 'Kategori wajib diisi').max(40),
  balance,
});

export const updateAssetSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    balance: balance.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Minimal satu field harus diubah');

export const updateBalanceSchema = z.object({ balance });

export const listAssetsQuery = z.object({ type: assetType.optional() });
export const balanceChangesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const assetIdParams = z.object({ id: z.uuid('ID tidak valid') });

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type AssetType = z.infer<typeof assetType>;
