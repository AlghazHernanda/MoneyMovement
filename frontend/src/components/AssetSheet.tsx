import { useState, type FormEvent } from 'react';
import { ApiError, type Asset, type AssetType } from '../api/client';
import { formatMoneyInput, parseMoneyInput } from '../format';

const CATEGORY_SUGGESTIONS: Record<AssetType, string[]> = {
  cash: ['Bank', 'E-Wallet', 'Tunai'],
  investment: ['Saham', 'Crypto', 'Reksa Dana', 'Emas', 'Obligasi', 'Deposito'],
};

type Values = { name: string; category: string; balance: number };

type Props = {
  type: AssetType;
  asset?: Asset;
  onClose: () => void;
  onSave: (values: Values) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function AssetSheet({ type, asset, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState(asset?.category ?? CATEGORY_SUGGESTIONS[type][0]!);
  const [balance, setBalance] = useState(asset?.balance ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = type === 'cash' ? 'Cash' : 'Investasi';
  const namePlaceholder = type === 'cash' ? 'contoh: BCA, GoPay' : 'contoh: BBCA, Bitcoin';

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.details?.map((d) => d.message).join(', ') ?? err.message)
          : 'Tidak dapat terhubung ke server',
      );
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(() => onSave({ name: name.trim(), category: category.trim(), balance }));
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit} noValidate>
        <div className="sheet-handle" />
        <h3>{asset ? `Ubah ${label}` : `Tambah ${label}`}</h3>
        <label>
          Nama
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder} maxLength={60} />
        </label>
        <label>
          Kategori
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list={`categories-${type}`}
            maxLength={40}
          />
          <datalist id={`categories-${type}`}>
            {CATEGORY_SUGGESTIONS[type].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          {type === 'cash' ? 'Saldo (Rp)' : 'Nilai saat ini (Rp)'}
          <input
            inputMode="numeric"
            value={formatMoneyInput(balance)}
            onChange={(e) => setBalance(parseMoneyInput(e.target.value))}
            placeholder="0"
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy || !name.trim() || !category.trim()}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
        {onDelete && (
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Hapus "${asset?.name}"?`)) void run(onDelete);
            }}
          >
            Hapus
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Batal
        </button>
      </form>
    </div>
  );
}
