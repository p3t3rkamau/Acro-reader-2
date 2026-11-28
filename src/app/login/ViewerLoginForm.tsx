'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import styles from '../admin/admin.module.scss';

export default function ViewerLoginForm() {
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
        intent: 'viewer',
        redirect: false,
      });

      if (result?.error) {
        setError('Sign-in failed. Check your details or contact the library administrator.');
        return;
      }

      window.location.assign('/');
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        Email address
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in to view manuals'}
      </button>
    </form>
  );
}
