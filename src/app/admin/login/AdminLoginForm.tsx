'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import styles from '../admin.module.scss';

export default function AdminLoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn('credentials', {
        email: String(formData.get('email') ?? ''),
        password: String(formData.get('password') ?? ''),
        intent: 'admin',
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid administrator email or password.');
        return;
      }

      window.location.assign('/admin');
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        Administrator email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in securely'}
      </button>
    </form>
  );
}
