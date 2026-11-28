import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type Asset, type AssetType } from '../api/client';
import { AssetSheet } from '../components/AssetSheet';
import { ASSET_TYPES } from '../assetTypes';
import { usePrivacy } from '../privacy/PrivacyContext';

type SheetState = { mode: 'create' } | { mode: 'edit'; asset: Asset } | null;

export function AssetsPage({ type }: { type: AssetType }) {
  const { money } = usePrivacy();
  const [items, setItems] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(() => {
    api
      .listAssets(type)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Gagal memuat data'));
  }, [type]);

  useEffect(() => {
    setItems(null);
    setError(null);
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const a of items ?? []) map.set(a.category, [...(map.get(a.category) ?? []), a]);
    return [...map.entries()];
  }, [items]);

  const total = (items ?? []).reduce((sum, a) => sum + a.balance, 0);
  const meta = ASSET_TYPES[type];
  const title = meta.title;

  return (
    <div className="page">
      <header className="hero">
        <span className="hero-label">Total {title}</span>
        <strong className="hero-value">{items ? money(total) : '…'}</strong>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {items && items.length === 0 && (
        <div className="card empty">
          <p>Belum ada {title.toLowerCase()}.</p>
          <p className="muted">{meta.emptyHint}</p>
        </div>
      )}

      {groups.map(([category, assets]) => (
        <section className="card" key={category}>
          <div className="section-head">
            <h3>{category}</h3>
            <span className="muted">{money(assets.reduce((s, a) => s + a.balance, 0))}</span>
          </div>
          <ul className="asset-list">
            {assets.map((a) => (
              <li key={a.id}>
                <button className="asset-row" onClick={() => setSheet({ mode: 'edit', asset: a })}>
                  <span>{a.name}</span>
                  <strong>{money(a.balance)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button className="fab" onClick={() => setSheet({ mode: 'create' })} aria-label={`Tambah ${title}`}>
        +
      </button>

      {sheet?.mode === 'create' && (
        <AssetSheet
          key="new"
          type={type}
          onClose={() => setSheet(null)}
          onCreate={async (values) => {
            await api.createAsset({ type, ...values });
            load();
          }}
        />
      )}
      {sheet?.mode === 'edit' && (
        <AssetSheet
          key={sheet.asset.id}
          type={type}
          asset={sheet.asset}
          onClose={() => setSheet(null)}
          onEdit={async (values) => {
            await api.updateAsset(sheet.asset.id, values);
            load();
          }}
          onDelete={async () => {
            await api.deleteAsset(sheet.asset.id);
            load();
          }}
          // Sheet tetap terbuka supaya user melihat selisih & timestamp; daftar di belakang ikut diperbarui.
          onBalanceUpdated={load}
        />
      )}
    </div>
  );
}
