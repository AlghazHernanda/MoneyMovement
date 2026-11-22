import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';

function ProtectedLayout() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app">
      <div className="topbar">
        <span>Halo, <strong>{user.username}</strong></span>
        <button className="link" onClick={logout}>Keluar</button>
      </div>
      <main>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/" end>
          <span aria-hidden>📈</span>Networth
        </NavLink>
        <NavLink to="/cash">
          <span aria-hidden>💵</span>Cash
        </NavLink>
        <NavLink to="/investasi">
          <span aria-hidden>📊</span>Investasi
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
