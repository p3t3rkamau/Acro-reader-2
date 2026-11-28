'use client';

import { useEffect, useState, type FormEvent } from 'react';
import styles from '../admin.module.scss';

type Viewer = {
  id: string;
  name: string | null;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerified: string | null;
  createdAt: string;
};

export default function ViewerManager() {
  const [users, setUsers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/viewers');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load viewer accounts.');
    setUsers(result.users as Viewer[]);
  }

  useEffect(() => {
    let active = true;
    fetch('/api/admin/viewers')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load viewer accounts.');
        return result.users as Viewer[];
      })
      .then((result) => { if (active) setUsers(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load viewer accounts.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/viewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? '').trim(),
          email: String(form.get('email') ?? '').trim(),
          password: String(form.get('password') ?? ''),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not create the account.');
      formElement.reset();
      await load();
      setMessage('Viewer account created. Share the login details with the authorised person securely.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(user: Viewer, status: 'ACTIVE' | 'SUSPENDED') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/viewers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not update the account.');
      await load();
      setMessage('Viewer account updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the account.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading viewer accounts…</p>;

  return (
    <div className={styles.uploadForm}>
      <div className={styles.card}>
        <h2>Create authorised viewer</h2>
        <p>These accounts are created and verified by the administrator. There is no public registration.</p>
        <form className={styles.formGrid} onSubmit={create}>
          <label>Name<input name="name" maxLength={120} /></label>
          <label>Email<input name="email" type="email" autoComplete="off" required /></label>
          <label className={styles.fullWidth}>Temporary password
            <input name="password" type="password" minLength={12} maxLength={200} autoComplete="new-password" required />
            <small>Use at least 12 characters. Share the password with the viewer through a separate secure channel.</small>
          </label>
          <button type="submit" disabled={busy}>Create viewer account</button>
        </form>
      </div>

      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.card}>
        <h2>Viewer accounts</h2>
        {!users.length && <p>No viewer accounts have been created.</p>}
        {users.map((user) => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #e8edf1' }}>
            <div>
              <strong>{user.name || user.email}</strong>
              <p style={{ margin: '4px 0', fontSize: 13 }}>{user.email}</p>
              <small>{user.status === 'ACTIVE' ? 'Active' : 'Suspended'} · Created {new Date(user.createdAt).toLocaleDateString()}</small>
            </div>
            <button type="button" disabled={busy} onClick={() => setStatus(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>
              {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
