import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistoryPoint, Range } from '../api/client';
import { formatCompactIDR, formatFullDate, formatIDR, formatShortDate } from '../format';

type Props = { points: HistoryPoint[]; range: Range };

export function NetworthChart({ points, range }: Props) {
  if (points.length === 0) {
    return <div className="chart-empty">Belum ada data. Tambahkan cash atau investasi untuk mulai melacak networth.</div>;
  }
  const longRange = range === '1Y' || range === '2Y';

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatShortDate(d, longRange)}
            tick={{ fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis tickFormatter={formatCompactIDR} tick={{ fontSize: 11 }} width={56} />
          <Tooltip
            labelFormatter={(d) => formatFullDate(String(d))}
            formatter={(v) => [formatIDR(Number(v)), 'Networth']}
          />
          <Area type="stepAfter" dataKey="networth" stroke="#0f766e" strokeWidth={2} fill="url(#nwFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
