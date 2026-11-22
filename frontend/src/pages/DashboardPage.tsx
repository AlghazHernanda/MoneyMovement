import { useEffect, useState } from 'react';
import { api, ApiError, type History, type Range, type Summary } from '../api/client';
import { NetworthChart } from '../components/NetworthChart';
import { formatIDR } from '../format';

const RANGES: { value: Range; label: string }[] = [
  { value: '1M', label: '1B' },
  { value: '3M', label: '3B' },
  { value: '6M', label: '6B' },
  { value: '1Y', label: '1T' },
  { value: '2Y', label: '2T' },
];

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [range, setRange] = useState<Range>('1M');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.summary().then(setSummary).catch((e) => setError(e instanceof ApiError ? e.message : 'Gagal memuat data'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    api
      .history(range)
      .then((h) => !cancelled && setHistory(h))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Gagal memuat grafik'));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const first = history?.points[0]?.networth;
  const last = history?.points.at(-1)?.networth;
  const change = first !== undefined && last !== undefined ? last - first : null;
  const changePct = change !== null && first ? (change / first) * 100 : null;

  return (
    <div className="page">
      <header className="hero">
        <span className="hero-label">Total Networth</span>
        <strong className="hero-value">{summary ? formatIDR(summary.networth) : '…'}</strong>
        {change !== null && (
          <span className={`hero-change ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '▲' : '▼'} {formatIDR(Math.abs(change))}
            {changePct !== null && ` (${changePct.toFixed(1)}%)`} dalam rentang ini
          </span>
        )}
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="split">
        <div className="card stat">
          <span>Cash</span>
          <strong>{summary ? formatIDR(summary.cash) : '…'}</strong>
        </div>
        <div className="card stat">
          <span>Investasi</span>
          <strong>{summary ? formatIDR(summary.investment) : '…'}</strong>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Perkembangan Networth</h3>
        </div>
        <div className="tabs" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r.value}
              role="tab"
              aria-selected={range === r.value}
              className={range === r.value ? 'tab active' : 'tab'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {history ? <NetworthChart points={history.points} range={range} /> : <div className="chart-empty">Memuat…</div>}
      </section>

      {summary && summary.byCategory.length > 0 && (
        <section className="card">
          <h3>Komposisi</h3>
          <ul className="breakdown">
            {[...summary.byCategory]
              .sort((a, b) => b.total - a.total)
              .map((c) => {
                const pct = summary.networth ? (c.total / summary.networth) * 100 : 0;
                return (
                  <li key={`${c.type}:${c.category}`}>
                    <div className="breakdown-row">
                      <span>
                        {c.category} <small className="muted">· {c.type === 'cash' ? 'Cash' : 'Investasi'}</small>
                      </span>
                      <span>{formatIDR(c.total)}</span>
                    </div>
                    <div className="bar">
                      <div className={`bar-fill ${c.type}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
