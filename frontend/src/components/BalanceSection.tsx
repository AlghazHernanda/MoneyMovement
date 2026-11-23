import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Asset, type BalanceChange } from '../api/client';
import { formatDateTime, formatDeltaIDR, formatIDR, formatMoneyInput, parseMoneyInput } from '../format';

type Props = {
  asset: Asset;
  /** Dipanggil setelah saldo berhasil di-update, supaya daftar di halaman ikut segar. */
  onUpdated: (asset: Asset) => void;
};

const errorMessage = (err: unknown) =>
  err instanceof ApiError
    ? (err.details?.map((d) => d.message).join(', ') ?? err.message)
    : 'Tidak dapat terhubung ke server';

/** Saldo saat ini + tombol Update + riwayat perubahan saldo. */
export function BalanceSection({ asset, onUpdated }: Props) {
  const [balance, setBalance] = useState(asset.balance);
  const [changes, setChanges] = useState<BalanceChange[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const [hasInput, setHasInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<BalanceChange | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = asset.type === 'cash' ? 'Saldo' : 'Nilai';

  useEffect(() => {
    let cancelled = false;
    api
      .listBalanceChanges(asset.id)
      .then((r) => !cancelled && setChanges(r.items))
      .catch((e) => !cancelled && setHistoryError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const delta = newBalance - balance;
  const canSubmit = hasInput && delta !== 0 && !busy;

  function startEditing() {
    setNewBalance(0);
    setHasInput(false);
    setError(null);
    setEditing(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { item, change } = await api.updateBalance(asset.id, newBalance);
      setBalance(item.balance);
      setLastChange(change);
      setChanges((prev) => [change, ...(prev ?? [])]);
      setEditing(false);
      onUpdated(item);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="balance-section">
      <div className="balance-current">
        <div>
          <span className="muted">{label} saat ini</span>
          <strong>{formatIDR(balance)}</strong>
        </div>
        {!editing && (
          <button type="button" className="btn primary small" onClick={startEditing}>
            Update
          </button>
        )}
      </div>

      {lastChange && !editing && (
        <div className={`change-banner ${lastChange.delta >= 0 ? 'up' : 'down'}`} role="status">
          <strong>
            {label} {lastChange.delta >= 0 ? 'bertambah' : 'berkurang'} {formatDeltaIDR(lastChange.delta)}
          </strong>
          <span>{formatDateTime(lastChange.changedAt)}</span>
        </div>
      )}

      {editing && (
        <form className="balance-update" onSubmit={onSubmit} noValidate>
          <label>
            {label} baru (Rp)
            <input
              ref={inputRef}
              inputMode="numeric"
              value={hasInput ? formatMoneyInput(newBalance) : ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setHasInput(digits.length > 0);
                setNewBalance(parseMoneyInput(digits));
              }}
              placeholder={formatMoneyInput(balance) || '0'}
            />
          </label>
          {hasInput && (
            <p className={`delta-preview ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
              {delta === 0
                ? `Sama dengan ${label.toLowerCase()} saat ini`
                : `${delta > 0 ? 'Bertambah' : 'Berkurang'} ${formatDeltaIDR(delta)}`}
            </p>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>
              Batal
            </button>
            <button className="btn primary" disabled={!canSubmit}>
              {busy ? 'Menyimpan…' : 'Simpan Update'}
            </button>
          </div>
        </form>
      )}

      <div className="history">
        <h4>Riwayat {label.toLowerCase()}</h4>
        {historyError && <p className="error">{historyError}</p>}
        {!changes && !historyError && <p className="muted">Memuat…</p>}
        {changes && changes.length === 0 && <p className="muted">Belum ada riwayat. Tekan Update untuk mencatat perubahan.</p>}
        {changes && changes.length > 0 && (
          <ul className="history-list">
            {changes.map((c) => (
              <li key={c.id}>
                <div className="history-main">
                  {c.previousBalance === null ? (
                    <span className="history-delta">{label} awal</span>
                  ) : (
                    <span className={`history-delta ${c.delta >= 0 ? 'up' : 'down'}`}>{formatDeltaIDR(c.delta)}</span>
                  )}
                  <span className="history-balance">
                    {c.previousBalance === null
                      ? formatIDR(c.newBalance)
                      : `${formatIDR(c.previousBalance)} → ${formatIDR(c.newBalance)}`}
                  </span>
                </div>
                <time className="muted" dateTime={c.changedAt}>
                  {formatDateTime(c.changedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
