import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { usePrivacy } from './privacy/PrivacyContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Grafik naik: total networth */
const NetworthIcon = () => (
  <svg {...iconProps}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="m7 15 4-4 3 3 6-7" />
    <path d="M16 7h4v4" />
  </svg>
);

/** Dompet: cash */
const WalletIcon = () => (
  <svg {...iconProps}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    <path d="M16.5 13.5h.01" strokeWidth={2.6} />
  </svg>
);

/** Grafik lilin: investasi */
const InvestIcon = () => (
  <svg {...iconProps}>
    <path d="M7 3v3M7 14v3M17 6v3M17 17v4" />
    <rect x="4.5" y="6" width="5" height="8" rx="1" />
    <rect x="14.5" y="9" width="5" height="8" rx="1" />
  </svg>
);

const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg {...iconProps}>
    <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.5 17.5 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </svg>
);

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const { hidden, toggle: toggleHidden } = usePrivacy();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app">
      <div className="topbar">
        <span>Halo, <strong>{user.username}</strong></span>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
            title={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
          >
            {hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button className="link" onClick={logout}>Keluar</button>
        </div>
      </div>
      <main>
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        <NavLink to="/" end>
          <span className="nav-icon"><NetworthIcon /></span>
          <span className="nav-label">Networth</span>
        </NavLink>
        <NavLink to="/cash">
          <span className="nav-icon"><WalletIcon /></span>
          <span className="nav-label">Cash</span>
        </NavLink>
        <NavLink to="/investasi">
          <span className="nav-icon"><InvestIcon /></span>
          <span className="nav-label">Investasi</span>
        </NavLink>
      </nav>
    </div>
  );
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export function App() {
  const { loading } = useAuth();
  if (loading) return <div className="splash">Memuat…</div>;

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="cash" element={<AssetsPage key="cash" type="cash" />} />
        <Route path="investasi" element={<AssetsPage key="investment" type="investment" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
