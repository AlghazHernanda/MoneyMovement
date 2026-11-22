import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="logo">₪</div>
        <h1>MoneyMovement</h1>
        <p>Catat aset, pantau networth kamu.</p>
      </div>
      <form className="card form" onSubmit={onSubmit} noValidate>
        <h2>Masuk</h2>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={submitting || !username || !password}>
          {submitting ? 'Memproses…' : 'Masuk'}
        </button>
        <p className="muted center">
          Belum punya akun? <Link to="/register">Daftar</Link>
        </p>
      </form>
    </div>
  );
}
