import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../../lib/errors.js';
import type { AssetType, CreateAssetInput, UpdateAssetInput } from './assets.schemas.js';

// Semua fungsi menerima `db` = client per-user (tunduk RLS).

const COLUMNS = 'id, type, name, category, balance, created_at, updated_at';

type AssetRow = { balance: number | string } & Record<string, unknown>;
export const toAssetDto = (row: AssetRow) => ({ ...row, balance: Number(row.balance) });

type ChangeRow = {
  id: number | string;
  asset_id: string;
  previous_balance: number | string | null;
  new_balance: number | string;
  delta: number | string;
  changed_at: string;
};

export type BalanceChangeDto = {
  id: number;
  assetId: string;
  /** null = saldo awal saat aset dibuat */
  previousBalance: number | null;
  newBalance: number;
  delta: number;
  changedAt: string;
};

export const toChangeDto = (row: ChangeRow): BalanceChangeDto => ({
  id: Number(row.id),
  assetId: row.asset_id,
  previousBalance: row.previous_balance === null ? null : Number(row.previous_balance),
  newBalance: Number(row.new_balance),
  delta: Number(row.delta),
  changedAt: row.changed_at,
});

export async function listAssets(db: SupabaseClient, type?: AssetType) {
  let query = db.from('assets').select(COLUMNS).order('created_at', { ascending: true });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toAssetDto);
}

export async function createAsset(db: SupabaseClient, userId: string, input: CreateAssetInput) {
  const { data, error } = await db
    .from('assets')
    .insert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toAssetDto(data);
}

export async function updateAsset(db: SupabaseClient, id: string, input: UpdateAssetInput) {
  const { data, error } = await db.from('assets').update(input).eq('id', id).select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Aset tidak ditemukan');
  return toAssetDto(data);
}

export async function deleteAsset(db: SupabaseClient, id: string) {
  const { data, error } = await db.from('assets').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Aset tidak ditemukan');
}

/**
 * Set saldo baru dan kembalikan perubahan yang tercatat (selisih dihitung di database).
 * Saldo yang sama dengan saldo saat ini ditolak supaya tidak ada riwayat kosong.
 */
export async function updateBalance(db: SupabaseClient, id: string, balance: number) {
  const { data, error } = await db.rpc('update_asset_balance', { p_asset_id: id, p_balance: balance });
  if (error) throw error;
  if (!data) throw notFound('Aset tidak ditemukan');

  const result = data as { asset: AssetRow; change: ChangeRow | null };
  if (!result.change) {
    throw new AppError(400, 'NO_CHANGE', 'Saldo baru sama dengan saldo saat ini');
  }
  return { item: toAssetDto(result.asset), change: toChangeDto(result.change) };
}

export async function listBalanceChanges(db: SupabaseClient, assetId: string, limit: number) {
  const { data: asset, error: assetError } = await db.from('assets').select('id').eq('id', assetId).maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw notFound('Aset tidak ditemukan');

  const { data, error } = await db
    .from('asset_balance_changes')
    .select('id, asset_id, previous_balance, new_balance, delta, changed_at')
    .eq('asset_id', assetId)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => toChangeDto(r as ChangeRow));
}
