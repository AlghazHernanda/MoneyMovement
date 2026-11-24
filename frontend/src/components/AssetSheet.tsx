import { useId, useState, type FormEvent } from 'react';
import { ApiError, type Asset, type AssetType } from '../api/client';
import { formatMoneyInput, parseMoneyInput } from '../format';
import { BalanceSection } from './BalanceSection';

const CATEGORY_SUGGESTIONS: Record<AssetType, string[]> = {
  cash: ['Bank', 'E-Wallet', 'Tunai'],
  investment: ['Saham', 'Crypto', 'Reksa Dana', 'Emas', 'Obligasi', 'Deposito'],
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
  </svg>
);
const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export type CreateValues = { name: string; category: string; balance: number };
export type EditValues = { name: string; category: string };

type Props = {
  type: AssetType;
  onClose: () => void;
} & (
  | { asset?: undefined; onCreate: (values: CreateValues) => Promise<void> }
  | {
      asset: Asset;
      onEdit: (values: EditValues) => Promise<void>;
      onDelete: () => Promise<void>;
      onBalanceUpdated: (asset: Asset) => void;
    }
);

export function AssetSheet(props: Props) {
  const { type, asset, onClose } = props;
  const formId = useId();
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState(asset?.category ?? CATEGORY_SUGGESTIONS[type][0]!);
  const [balance, setBalance] = useState(0);
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
    const base = { name: name.trim(), category: category.trim() };
    if (props.asset) void run(() => props.onEdit(base));
    else void run(() => props.onCreate({ ...base, balance }));
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <h3>{asset ? `Ubah ${label}` : `Tambah ${label}`}</h3>

        <form id={formId} className="sheet-form" onSubmit={onSubmit} noValidate>
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
          {!asset && (
            <label>
              {type === 'cash' ? 'Saldo (Rp)' : 'Nilai saat ini (Rp)'}
              <input
                inputMode="numeric"
                value={formatMoneyInput(balance)}
                onChange={(e) => setBalance(parseMoneyInput(e.target.value))}
                placeholder="0"
              />
            </label>
          )}
        </form>

        {props.asset && <BalanceSection asset={props.asset} onUpdated={props.onBalanceUpdated} />}

        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" form={formId} className="btn primary block" disabled={busy || !name.trim() || !category.trim()}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden /> Menyimpan…
            </>
          ) : (
            <>
              <CheckIcon />
              {asset ? 'Simpan Nama & Kategori' : 'Simpan'}
            </>
          )}
        </button>
        <div className={props.asset ? 'btn-row' : 'btn-row single'}>
          {props.asset && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`Hapus "${props.asset.name}"? Riwayat saldonya juga akan terhapus.`)) void run(props.onDelete);
              }}
            >
              <TrashIcon />
              Hapus
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            <CloseIcon />
            {asset ? 'Tutup' : 'Batal'}
          </button>
        </div>
      </div>
    </div>
  );
}
