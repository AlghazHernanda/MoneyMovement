import type { AssetType } from './api/client';

export type AssetTypeMeta = {
  /** Judul menu/halaman: "Cash" */
  title: string;
  /** Kata untuk nominal pada aset ini: "Saldo", "Nilai", "Sisa utang" */
  balanceLabel: string;
  /** Label kolom nominal saat membuat aset baru */
  createBalanceLabel: string;
  namePlaceholder: string;
  categories: string[];
  emptyHint: string;
  /** true = menambah nilai ini MENGURANGI networth */
  reducesNetworth: boolean;
};

export const ASSET_TYPES: Record<AssetType, AssetTypeMeta> = {
  cash: {
    title: 'Cash',
    balanceLabel: 'Saldo',
    createBalanceLabel: 'Saldo (Rp)',
    namePlaceholder: 'contoh: BCA, GoPay',
    categories: ['Bank', 'E-Wallet', 'Tunai'],
    emptyHint: 'Tambahkan saldo per bank atau e-wallet, misalnya BCA dan Mandiri.',
    reducesNetworth: false,
  },
  investment: {
    title: 'Investasi',
    balanceLabel: 'Nilai',
    createBalanceLabel: 'Nilai saat ini (Rp)',
    namePlaceholder: 'contoh: BBCA, Bitcoin',
    categories: ['Saham', 'Crypto', 'Reksa Dana', 'Emas', 'Obligasi', 'Deposito'],
    emptyHint: 'Tambahkan nilai investasi, misalnya saham dan crypto.',
    reducesNetworth: false,
  },
  liability: {
    title: 'Liabilitas',
    balanceLabel: 'Sisa utang',
    createBalanceLabel: 'Sisa utang (Rp)',
    namePlaceholder: 'contoh: KPR BCA, Kartu Kredit',
    categories: ['KPR', 'Kendaraan', 'Kartu Kredit', 'Paylater', 'Pinjaman', 'Lainnya'],
    emptyHint: 'Catat utang dan cicilan, misalnya KPR atau kartu kredit. Sisa utang akan mengurangi networth.',
    reducesNetworth: true,
  },
};

/** Perubahan nominal dianggap "baik" (hijau) kalau networth naik karenanya. */
export const isGoodChange = (type: AssetType, delta: number) =>
  ASSET_TYPES[type].reducesNetworth ? delta < 0 : delta > 0;
