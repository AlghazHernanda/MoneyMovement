import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../../gateway/validate.js';
import { authenticate } from '../../gateway/auth.js';

export const TIMEZONE = 'Asia/Jakarta';
const TZ_OFFSET = '+07:00'; // Asia/Jakarta tidak memakai DST

const RANGE_MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24 } as const;
const historyQuery = z.object({
  range: z.enum(Object.keys(RANGE_MONTHS) as [keyof typeof RANGE_MONTHS]).default('1M'),
});

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

type Point = { date: string; cash: number; investment: number; networth: number };

export async function networthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/summary', async (request) => {
    const { data, error } = await request.db.from('assets').select('type, category, balance');
    if (error) throw error;

    let cash = 0;
    let investment = 0;
    const byCategory = new Map<string, { type: string; category: string; total: number }>();
    for (const row of data ?? []) {
      const value = Number(row.balance);
      if (row.type === 'cash') cash += value;
      else investment += value;
      const key = `${row.type}:${row.category}`;
      const entry = byCategory.get(key) ?? { type: row.type, category: row.category, total: 0 };
      entry.total += value;
      byCategory.set(key, entry);
    }
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      cash: round(cash),
      investment: round(investment),
      networth: round(cash + investment),
      byCategory: [...byCategory.values()].map((c) => ({ ...c, total: round(c.total) })),
    };
  });

  app.get('/history', async (request) => {
    const { range } = parse(historyQuery, request.query);
    const today = jakartaDate(new Date());
    const startDate = rangeStartDate(today, RANGE_MONTHS[range]);
    const startTs = `${startDate}T00:00:00${TZ_OFFSET}`;

    const [daily, baseline] = await Promise.all([
      request.db.rpc('networth_history', { p_start: startTs, p_tz: TIMEZONE }),
      request.db
        .from('networth_snapshots')
        .select('total_cash, total_investment, networth')
        .lt('recorded_at', startTs)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (daily.error) throw daily.error;
    if (baseline.error) throw baseline.error;

    const points: Point[] = [];
    if (baseline.data) {
      // Nilai yang berlaku di awal rentang (dari snapshot terakhir sebelum rentang).
      points.push({
        date: startDate,
        cash: Number(baseline.data.total_cash),
        investment: Number(baseline.data.total_investment),
        networth: Number(baseline.data.networth),
      });
    }
    for (const row of (daily.data ?? []) as Record<string, unknown>[]) {
      const point: Point = {
        date: String(row.day),
        cash: Number(row.total_cash),
        investment: Number(row.total_investment),
        networth: Number(row.networth),
      };
      if (points.at(-1)?.date === point.date) points[points.length - 1] = point;
      else points.push(point);
    }
    // Perpanjang garis sampai hari ini dengan nilai terakhir.
    const last = points.at(-1);
    if (last && last.date !== today) points.push({ ...last, date: today });

    return { range, startDate, endDate: today, points };
  });
}
