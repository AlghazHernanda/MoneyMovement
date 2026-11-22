const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const formatIDR = (value: number) => idr.format(value);

/** Format ringkas untuk sumbu grafik: 1,5 jt, 2,3 M, 1,1 T. */
export function formatCompactIDR(value: number): string {
  const abs = Math.abs(value);
  const fmt = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  if (abs >= 1e12) return `${fmt(value / 1e12)} T`;
  if (abs >= 1e9) return `${fmt(value / 1e9)} M`;
  if (abs >= 1e6) return `${fmt(value / 1e6)} jt`;
  if (abs >= 1e3) return `${fmt(value / 1e3)} rb`;
  return fmt(value);
}

/** "2026-11-22" -> "22 Nov" (atau "Nov 26" untuk rentang panjang). */
export function formatShortDate(iso: string, long = false): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return long
    ? date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export const formatFullDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Input uang: ambil digit saja, tampilkan dengan titik ribuan. */
export const parseMoneyInput = (text: string): number => Number(text.replace(/\D/g, '') || '0');
export const formatMoneyInput = (value: number): string => (value ? value.toLocaleString('id-ID') : '');
