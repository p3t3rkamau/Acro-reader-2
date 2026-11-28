'use client';

import { useEffect, useState } from 'react';
import styles from '../admin.module.scss';

type PendingRevision = {
  id: string;
  title: string;
  revision: string;
  originalFileName: string | null;
};
type LegacyCopy = PendingRevision & { legacyPublicStoragePath: string | null };
type MigrationData = { count: number; revisions: PendingRevision[]; legacyCopies: LegacyCopy[] };

export default function StorageMigrationManager() {
  const [data, setData] = useState<MigrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/admin/storage/migrate');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load storage migration status.');
    setData(result as MigrationData);
  }

  useEffect(() => {
    let active = true;
    fetch('/api/admin/storage/migrate')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not load storage migration status.');
        return result as MigrationData;
      })
      .then((result) => { if (active) setData(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load migration status.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function migrateAll() {
    if (!data?.revisions.length || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    setProgress(0);

    let completed = 0;
    for (const revision of data.revisions) {
      try {
        const response = await fetch('/api/admin/storage/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revisionId: revision.id }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? `Could not migrate ${revision.title}.`);
        completed += 1;
        setProgress(Math.round((completed / data.revisions.length) * 100));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'A PDF migration failed.');
        break;
      }
    }

    await load();
    setMessage(`${completed} of ${data.revisions.length} public revisions copied and verified.`);
    setBusy(false);
  }

  async function deleteLegacyCopy(revision: LegacyCopy) {
    const approved = window.confirm(
      `Delete the old PUBLIC Blob copy for “${revision.title}” revision ${revision.revision}? This cannot be undone. The private copy will be checked again first.`,
    );
    if (!approved) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/storage/migrate', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId: revision.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not delete the old public copy.');
      await load();
      setMessage(`Deleted the old public copy for ${revision.title}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the old public copy.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading storage migration status…</p>;
  if (!data) return <p className={styles.error}>{error || 'Storage migration status is unavailable.'}</p>;

  return (
    <div className={styles.uploadForm}>
      <div className={styles.card}>
        <h2>Step 1 · Copy public PDFs into private storage</h2>
        <p>{data.count} revision(s) are still marked as public storage. Each PDF is streamed into the private store and verified before its database record is changed.</p>
        {data.revisions.map((revision) => (
          <p key={revision.id}>{revision.title} · Revision {revision.revision} · {revision.originalFileName}</p>
        ))}
        {!data.count && <p>All recorded revisions have been copied to private storage.</p>}
        {busy && <div className={styles.progress}><span style={{ width: `${progress}%` }} /></div>}
        {busy && <p className={styles.status}>Migrating… {progress}%</p>}
        <button type="button" disabled={busy || !data.count} onClick={migrateAll}>
          {busy ? 'Working…' : 'Copy and verify all public PDFs'}
        </button>
      </div>

      <div className={styles.card}>
        <h2>Step 2 · Remove old public copies</h2>
        <p>Only use the red delete button after migration. The system checks the private copy again before removing the public original. This action cannot be undone.</p>
        {data.legacyCopies.map((revision) => (
          <div key={revision.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #e8edf1' }}>
            <div>
              <strong>{revision.title}</strong>
              <p style={{ margin: '4px 0', fontSize: 13 }}>Revision {revision.revision}</p>
              <small>{revision.legacyPublicStoragePath}</small>
            </div>
            <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => deleteLegacyCopy(revision)}>
              Delete public copy
            </button>
          </div>
        ))}
        {!data.legacyCopies.length && <p>No legacy public copies are waiting for deletion.</p>}
      </div>

      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
