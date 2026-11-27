import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { formatCompactIDR, formatDeltaIDR, formatIDR } from '../format';

const STORAGE_KEY = 'mm.hideBalances';
const MASK = '••••••••';

type PrivacyState = {
  /** true = semua nominal uang disamarkan */
  hidden: boolean;
  toggle: () => void;
  /** Rp 1.000.000 atau Rp •••••••• */
  money: (value: number) => string;
  /** +Rp 5.000.000 atau +Rp •••••••• (tanda tetap terlihat) */
  delta: (value: number) => string;
  /** 1,5 jt atau •••• (untuk sumbu grafik) */
  compact: (value: number) => string;
};

const PrivacyContext = createContext<PrivacyState | null>(null);

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(readStored);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // penyimpanan tidak tersedia: tetap berlaku untuk sesi ini
      }
      return next;
    });
  }, []);

  const value = useMemo<PrivacyState>(
    () => ({
      hidden,
      toggle,
      money: (v) => (hidden ? `Rp ${MASK}` : formatIDR(v)),
      delta: (v) => (hidden ? `${v >= 0 ? '+' : '−'}Rp ${MASK}` : formatDeltaIDR(v)),
      compact: (v) => (hidden ? '••••' : formatCompactIDR(v)),
    }),
    [hidden, toggle],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy harus dipakai di dalam PrivacyProvider');
  return ctx;
}
