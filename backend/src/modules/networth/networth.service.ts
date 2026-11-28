import type { SupabaseClient } from '@supabase/supabase-js';
import { RANGE_MONTHS, type Range } from './networth.schemas.js';

export const TIMEZONE = 'Asia/Jakarta';
const TZ_OFFSET = '+07:00'; // Asia/Jakarta tidak memakai DST

export type AssetBalanceRow = { type: string; category: string; balance: number | string };
export type SnapshotValues = {
  total_cash: number | string;
  total_investment: number | string;
  total_liability: number | string;
  networth: number | string;
};
export type DailySnapshotRow = SnapshotValues & { day: string };
export type Point = {
  date: string;
  cash: number;
  investment: number;
  liability: number;
  networth: number;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Fungsi murni (tanpa I/O): mudah diuji unit.
// ---------------------------------------------------------------------------

/** Tanggal (YYYY-MM-DD) di zona Asia/Jakarta. */
export function jakartaDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Tanggal awal rentang: hari ini (WIB) dikurangi N bulan, hari di-clamp ke akhir bulan. */
export function rangeStartDate(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const totalMonths = y * 12 + (m - 1) - months;
  const ty = Math.floor(totalMonths / 12);
  const tm = totalMonths % 12; // 0-based
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

/** Total cash, investasi, liabilitas, networth (= cash + investasi - liabilitas), dan total per (type, category). */
export function computeSummary(rows: AssetBalanceRow[]) {
  let cash = 0;
  let investment = 0;
  let liability = 0;
  const byCategory = new Map<string, { type: string; category: string; total: number }>();
  for (const row of rows) {
    const value = Number(row.balance);
    if (row.type === 'cash') cash += value;
    else if (row.type === 'investment') investment += value;
    else if (row.type === 'liability') liability += value;
    else continue; // tipe tidak dikenal: abaikan
    const key = `${row.type}:${row.category}`;
    const entry = byCategory.get(key) ?? { type: row.type, category: row.category, total: 0 };
    entry.total += value;
    byCategory.set(key, entry);
  }
  return {
    cash: round2(cash),
    investment: round2(investment),
    liability: round2(liability),
    networth: round2(cash + investment - liability),
    byCategory: [...byCategory.values()].map((c) => ({ ...c, total: round2(c.total) })),
  };
}

const toPoint = (date: string, s: SnapshotValues): Point => ({
  date,
  cash: Number(s.total_cash),
  investment: Number(s.total_investment),
  liability: Number(s.total_liability ?? 0),
  networth: Number(s.networth),
});

/**
 * Susun titik grafik:
 * - baseline (snapshot terakhir sebelum rentang) ditaruh di startDate,
 * - satu titik per hari dari `daily` (hari yang sama dengan baseline ditimpa),
 * - garis diperpanjang sampai `today` dengan nilai terakhir.
 */
export function buildHistoryPoints(params: {
  startDate: string;
  today: string;
  baseline: SnapshotValues | null;
  daily: DailySnapshotRow[];
}): Point[] {
  const points: Point[] = [];
  if (params.baseline) points.push(toPoint(params.startDate, params.baseline));
  for (const row of params.daily) {
    const point = toPoint(String(row.day), row);
    if (points.at(-1)?.date === point.date) points[points.length - 1] = point;
    else points.push(point);
  }
  const last = points.at(-1);
  if (last && last.date !== params.today) points.push({ ...last, date: params.today });
  return points;
}

// ---------------------------------------------------------------------------
// Akses data. `db` adalah client per-user (tunduk RLS).
// ---------------------------------------------------------------------------

export async function getSummary(db: SupabaseClient) {
  const { data, error } = await db.from('assets').select('type, category, balance');
  if (error) throw error;
  return computeSummary((data ?? []) as AssetBalanceRow[]);
}

export async function getHistory(db: SupabaseClient, range: Range, now: Date = new Date()) {
  const today = jakartaDate(now);
  const startDate = rangeStartDate(today, RANGE_MONTHS[range]);
  const startTs = `${startDate}T00:00:00${TZ_OFFSET}`;

  const [daily, baseline] = await Promise.all([
    db.rpc('networth_history', { p_start: startTs, p_tz: TIMEZONE }),
    db
      .from('networth_snapshots')
      .select('total_cash, total_investment, total_liability, networth')
      .lt('recorded_at', startTs)
      .order('recorded_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (daily.error) throw daily.error;
  if (baseline.error) throw baseline.error;

  const points = buildHistoryPoints({
    startDate,
    today,
    baseline: (baseline.data as SnapshotValues | null) ?? null,
    daily: (daily.data ?? []) as DailySnapshotRow[],
  });
  return { range, startDate, endDate: today, points };
}
