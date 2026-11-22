import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

type Fields = { username: string; email: string; phone: string; password: string };

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState<Fields>({ username: '', email: '', phone: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({ ...form, username: form.username.trim(), email: form.email.trim(), phone: form.phone.trim() });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.length) {
          setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
        } else {
          setError(err.message);
        }
      } else {
        setError('Tidak dapat terhubung ke server');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key: keyof Fields) =>
    fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null;

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="logo">₪</div>
        <h1>Buat Akun</h1>
      </div>
      <form className="card form" onSubmit={onSubmit} noValidate>
        <label>
          Username
          <input value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" />
          {fieldError('username')}
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
          {fieldError('email')}
        </label>
        <label>
          No. Telepon
          <input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            autoComplete="tel"
            inputMode="tel"
            placeholder="081234567890"
          />
          {fieldError('phone')}
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          {fieldError('password') ?? <span className="hint">Minimal 8 karakter</span>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={submitting}>
          {submitting ? 'Memproses…' : 'Daftar'}
        </button>
        <p className="muted center">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
      </form>
    </div>
  );
}
